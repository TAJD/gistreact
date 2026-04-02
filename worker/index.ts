interface GitHubUser {
  login: string;
  avatar_url: string;
  id: number;
}

function createLogger(request?: Request) {
  const requestId = request?.headers.get('cf-ray') || 'no-req'
  return {
    info: (msg: string): void => { console.log(JSON.stringify({ level: 'info', requestId, msg, ts: Date.now() })) },
    error: (msg: string, err?: unknown): void => { console.error(JSON.stringify({ level: 'error', requestId, msg, err: String(err), ts: Date.now() })) },
  }
}

// Module-level logger (no request context, no async operations)
const log = { info: (_msg: string): void => {}, error: (_msg: string, _err?: unknown): void => {} }

async function checkRateLimit(
  env: Env,
  clientIP: string,
  endpoint: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const now = Math.floor(Date.now() / (windowSeconds * 1000));

    // Upsert into rate_limits table
    await env.DB.prepare(`
      INSERT INTO rate_limits (ip, endpoint, window_start, request_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(ip, endpoint, window_start) DO UPDATE SET
        request_count = request_count + 1
    `).bind(clientIP, endpoint, now).run();

    // Get current count for this window
    const record = await env.DB.prepare(`
      SELECT request_count FROM rate_limits
      WHERE ip = ? AND endpoint = ? AND window_start = ?
    `).bind(clientIP, endpoint, now).first();

    const currentCount = (record?.request_count as number) || 1;
    const allowed = currentCount <= maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount);

    // Cleanup old entries occasionally (1% of requests)
    if (Math.random() < 0.01) {
      const cutoffWindow = now - 5;
      await env.DB.prepare(`
        DELETE FROM rate_limits WHERE window_start < ?
      `).bind(cutoffWindow).run();
    }

    return { allowed, remaining };
  } catch (error) {
    // Silently allow if DB fails - don't block users on rate limit DB errors
    log.error('Rate limit check failed:', error);
    return { allowed: true, remaining: maxRequests };
  }
}

async function signCookie(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

interface GistFile {
  filename: string;
  content: string;
  raw_url: string;
}

interface GistResponse {
  files: Record<string, GistFile>;
  description: string;
  created_at: string;
  updated_at: string;
}

function generateShareId(): string {
  // Generate a short random ID for sharing
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function storeGistForSharing(env: Env, gistId: string, filename: string, content: string, description: string): Promise<string> {
  const timestamp = new Date().toISOString();
  
  try {
    // Check if this gist is already stored
    const existing = await env.DB.prepare(`
      SELECT share_id FROM stored_gists 
      WHERE original_gist_id = ? AND filename = ?
    `).bind(gistId, filename).first();
    
    if (existing) {
      log.info(`[${timestamp}] 🔗 Using existing share ID for ${gistId}/${filename}: ${existing.share_id}`);
      return existing.share_id as string;
    }
    
    // Generate new share ID
    let shareId = generateShareId();
    let attempts = 0;
    
    // Ensure unique share ID
    while (attempts < 10) {
      const collision = await env.DB.prepare(`
        SELECT share_id FROM stored_gists WHERE share_id = ?
      `).bind(shareId).first();
      
      if (!collision) break;
      shareId = generateShareId();
      attempts++;
    }
    
    if (attempts >= 10) {
      log.error(`[${timestamp}] 💥 Could not generate unique share ID after 10 attempts`);
      throw new Error('Could not generate unique share ID');
    }
    
    // Store the gist
    await env.DB.prepare(`
      INSERT INTO stored_gists (share_id, original_gist_id, filename, content, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(shareId, gistId, filename, content, description).run();
    
    log.info(`[${timestamp}] ✅ Stored gist ${gistId}/${filename} with share ID: ${shareId}`);
    return shareId;
  } catch (error) {
    log.error(`[${timestamp}] 💥 Error storing gist for sharing:`, error);
    throw error;
  }
}

async function updateShareId(env: Env, gistId: string, filename: string, oldShareId: string, newShareId: string): Promise<boolean> {
  const timestamp = new Date().toISOString();
  
  try {
    // Validate new share ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(newShareId)) {
      throw new Error('Custom name can only contain letters, numbers, hyphens, and underscores');
    }
    
    if (newShareId.length < 3) {
      throw new Error('Custom name must be at least 3 characters');
    }
    
    if (newShareId.length > 50) {
      throw new Error('Custom name must be less than 50 characters');
    }
    
    // Check if new share ID is already taken
    const collision = await env.DB.prepare(`
      SELECT share_id FROM stored_gists WHERE share_id = ? AND share_id != ?
    `).bind(newShareId, oldShareId).first();
    
    if (collision) {
      throw new Error('This custom name is already taken. Please choose another.');
    }
    
    // Update the share ID
    const result = await env.DB.prepare(`
      UPDATE stored_gists 
      SET share_id = ?, last_accessed_at = CURRENT_TIMESTAMP
      WHERE original_gist_id = ? AND filename = ? AND share_id = ?
    `).bind(newShareId, gistId, filename, oldShareId).run();
    
    if (!result.success || result.meta.changes === 0) {
      log.info(`[${timestamp}] 🚫 No rows updated for ${gistId}/${filename} ${oldShareId} -> ${newShareId}`);
      throw new Error('Share ID not found or could not be updated');
    }
    
    log.info(`[${timestamp}] ✅ Updated share ID for ${gistId}/${filename}: ${oldShareId} -> ${newShareId}`);
    return true;
  } catch (error) {
    log.error(`[${timestamp}] 💥 Error updating share ID:`, error);
    throw error;
  }
}

async function getStoredGist(env: Env, shareId: string): Promise<{content: string, filename: string, originalGistId: string} | null> {
  const timestamp = new Date().toISOString();
  
  try {
    const result = await env.DB.prepare(`
      SELECT content, filename, original_gist_id
      FROM stored_gists 
      WHERE share_id = ?
    `).bind(shareId).first();
    
    if (!result) {
      log.info(`[${timestamp}] 🚫 No stored gist found for share ID: ${shareId}`);
      return null;
    }
    
    // Update access count
    await env.DB.prepare(`
      UPDATE stored_gists 
      SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE share_id = ?
    `).bind(shareId).run();
    
    log.info(`[${timestamp}] 🎯 Retrieved stored gist for share ID: ${shareId}`);
    return {
      content: result.content as string,
      filename: result.filename as string,
      originalGistId: result.original_gist_id as string
    };
  } catch (error) {
    log.error(`[${timestamp}] 💥 Error retrieving stored gist:`, error);
    return null;
  }
}


// Helper function: exponential backoff retry
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        log.info(`[${new Date().toISOString()}] 🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Helper function: get cached gist from stored_gists
async function getCachedGist(env: Env, gistId: string): Promise<{ content: string; filename: string; description: string } | null> {
  try {
    const cached = await env.DB.prepare(`
      SELECT content, filename, description, original_gist_id
      FROM stored_gists
      WHERE original_gist_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(gistId).first();

    if (cached) {
      log.info(`[${new Date().toISOString()}] 💾 Found cached version for gist ${gistId}`);
      return {
        content: cached.content as string,
        filename: cached.filename as string,
        description: (cached.description as string) || 'Cached component'
      };
    }

    return null;
  } catch (error) {
    log.error(`[${new Date().toISOString()}] ❌ Error fetching from cache:`, error);
    return null;
  }
}

async function fetchGistComponent(gistId: string, env: Env): Promise<{ content: string; filename: string; description: string; fromCache?: boolean } | null> {
  const startTime = new Date();
  const timestamp = startTime.toISOString();

  log.info(`[${timestamp}] 🚀 Starting gist fetch for ID: ${gistId}`);

  // Try to fetch from GitHub with retry logic
  try {
    const result = await retryWithBackoff(async () => {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (compatible; ReactDrop/1.0)',
        'Accept': 'application/vnd.github.v3+json'
      };

      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);

      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers,
        redirect: 'follow',
        signal: fetchController.signal,
      });
      clearTimeout(fetchTimeout);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const gist: GistResponse = await response.json();

      // Find first .tsx file
      const files = Object.values(gist.files);
      log.info(`[${new Date().toISOString()}] 📁 Files in gist ${gistId}: [${files.map(f => f.filename).join(', ')}]`);

      const tsxFile = files.find(file => file.filename.endsWith('.tsx'));

      if (!tsxFile) {
        log.info(`[${new Date().toISOString()}] ⚠️  No .tsx file found in gist ${gistId}`);
        throw new Error('No .tsx file found');
      }

      const totalDuration = Date.now() - startTime.getTime();
      const contentLength = tsxFile.content.length;
      log.info(`[${new Date().toISOString()}] ✅ Successfully loaded gist ${gistId}`);
      log.info(`[${new Date().toISOString()}] 📄 File: ${tsxFile.filename} (${contentLength} characters)`);
      log.info(`[${new Date().toISOString()}] ⏱️  Total processing time: ${totalDuration}ms`);
      log.info(`[${new Date().toISOString()}] 🎯 Gist created: ${gist.created_at}, updated: ${gist.updated_at}`);

      return {
        content: tsxFile.content,
        filename: tsxFile.filename,
        description: gist.description,
        fromCache: false
      };
    }, 3, 1000); // 3 retries with 1s initial delay

    return result;

  } catch (error) {
    const totalDuration = Date.now() - startTime.getTime();
    log.error(`[${new Date().toISOString()}] 💥 GitHub fetch failed after retries for ${gistId} (${totalDuration}ms):`, error);

    // Fall back to cached version
    log.info(`[${new Date().toISOString()}] 💾 Attempting to load from cache...`);
    const cached = await getCachedGist(env, gistId);

    if (cached) {
      log.info(`[${new Date().toISOString()}] ✅ Returning cached version for ${gistId}`);
      return {
        ...cached,
        fromCache: true
      };
    }

    log.info(`[${new Date().toISOString()}] ❌ No cached version available for ${gistId}`);
    return null;
  }
}

async function updateAnalytics(env: Env, gistId: string, filename: string, success: boolean, error?: string) {
  const timestamp = new Date().toISOString();
  
  try {
    if (success) {
      log.info(`[${timestamp}] 📈 Recording successful view for ${gistId}/${filename}`);
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          view_count = view_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename).run();
      log.info(`[${timestamp}] ✅ Analytics updated successfully for ${gistId}/${filename}`);
    } else {
      log.info(`[${timestamp}] 📉 Recording error for ${gistId}/${filename}: ${error}`);
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count, error_count, last_error)
        VALUES (?, ?, 0, 1, ?)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          error_count = error_count + 1,
          last_error = ?,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename, error, error).run();
      log.info(`[${timestamp}] ⚠️  Error analytics updated for ${gistId}/${filename}`);
    }
  } catch (dbError) {
    log.error(`[${timestamp}] 💥 Database error for ${gistId}/${filename}:`, dbError);
  }
}

async function getRecentGists(env: Env, limit: number = 10) {
  try {
    const result = await env.DB.prepare(`
      SELECT gist_id, filename, first_accessed_at, view_count
      FROM gist_analytics
      WHERE view_count > 0
      ORDER BY first_accessed_at DESC
      LIMIT ?
    `).bind(limit).all();
    return result.results;
  } catch (error) {
    log.error('Database error:', error);
    return [];
  }
}

async function getPopularGists(env: Env, limit: number = 10) {
  try {
    const result = await env.DB.prepare(`
      SELECT gist_id, filename, view_count, first_accessed_at
      FROM gist_analytics
      WHERE view_count > 0
      ORDER BY view_count DESC, first_accessed_at DESC
      LIMIT ?
    `).bind(limit).all();
    return result.results;
  } catch (error) {
    log.error('Database error:', error);
    return [];
  }
}

export default {
  async fetch(request, env) {
    const log = createLogger(request);
    const requestStart = new Date();
    const timestamp = requestStart.toISOString();
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    
    log.info(`[${timestamp}] 🌐 ${request.method} ${path} - IP: ${clientIP} - UA: ${userAgent.substring(0, 100)}`);
    
    // Security headers applied to all responses
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...securityHeaders,
    };

    // Rate limiting checks
    const windowSeconds = 60;
    let rateLimitResult = null;
    let rateLimitEndpoint = null;

    if (path.startsWith('/proxy')) {
      rateLimitEndpoint = '/proxy*';
      rateLimitResult = await checkRateLimit(env, clientIP, rateLimitEndpoint, 30, windowSeconds);
    } else if (path.startsWith('/api/auth/')) {
      rateLimitEndpoint = '/api/auth/*';
      rateLimitResult = await checkRateLimit(env, clientIP, rateLimitEndpoint, 10, windowSeconds);
    } else if (path.startsWith('/api/')) {
      rateLimitEndpoint = '/api/*';
      rateLimitResult = await checkRateLimit(env, clientIP, rateLimitEndpoint, 60, windowSeconds);
    }

    if (rateLimitResult && !rateLimitResult.allowed) {
      log.info(`[${timestamp}] 🚫 Rate limit exceeded for ${clientIP} on ${rateLimitEndpoint}`);
      return Response.json(
        { error: 'Rate limit exceeded', retryAfter: windowSeconds },
        { status: 429, headers: securityHeaders }
      );
    }

    // Proxy endpoint for external resources (hardened)
    if (path.startsWith("/proxy")) {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return Response.json({ error: 'Missing url parameter' }, { status: 400, headers: securityHeaders });
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return Response.json({ error: 'Invalid URL' }, { status: 400, headers: securityHeaders });
      }

      // Only allow HTTPS
      if (parsedUrl.protocol !== 'https:') {
        return Response.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400, headers: securityHeaders });
      }

      // Domain allowlist for proxy
      const ALLOWED_PROXY_DOMAINS = [
        'cdn.tailwindcss.com',
        'cdn.jsdelivr.net',
        'unpkg.com',
        'cdnjs.cloudflare.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
      ];
      if (!ALLOWED_PROXY_DOMAINS.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain))) {
        log.info(`[${new Date().toISOString()}] 🚫 Proxy blocked: ${parsedUrl.hostname} not in allowlist`);
        return Response.json({ error: 'Domain not allowed' }, { status: 403, headers: securityHeaders });
      }

      // Block private/internal IP ranges (SSRF prevention)
      const hostname = parsedUrl.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
          hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
          hostname.startsWith('172.16.') || hostname.startsWith('172.17.') ||
          hostname.startsWith('172.18.') || hostname.startsWith('172.19.') ||
          hostname.startsWith('172.2') || hostname.startsWith('172.30.') ||
          hostname.startsWith('172.31.') || hostname === '0.0.0.0' ||
          hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        log.info(`[${new Date().toISOString()}] 🚫 Proxy blocked SSRF attempt: ${hostname}`);
        return Response.json({ error: 'Internal addresses not allowed' }, { status: 403, headers: securityHeaders });
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const proxyResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'ReactDrop-Proxy/1.0'
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Limit response size to 5MB
        const contentLength = parseInt(proxyResponse.headers.get('content-length') || '0');
        if (contentLength > 5 * 1024 * 1024) {
          return Response.json({ error: 'Response too large (max 5MB)' }, { status: 413, headers: securityHeaders });
        }

        const response = new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: proxyResponse.headers
        });

        // Add CORS and security headers
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        response.headers.set('X-Content-Type-Options', 'nosniff');

        return response;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        log.info(`[${new Date().toISOString()}] 💥 Proxy request failed for ${targetUrl}: ${errMsg}`);
        return Response.json({ error: 'Proxy request failed' }, { status: 500, headers: securityHeaders });
      }
    }

    // GitHub OAuth: initiate login (with CSRF state parameter)
    if (path === '/api/auth/login') {
      const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
      const redirectUri = `${url.origin}/api/auth/callback`;
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
      return new Response(null, {
        status: 302,
        headers: {
          'Location': githubAuthUrl,
          'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
          ...securityHeaders,
        },
      });
    }

    // GitHub OAuth: callback (verify CSRF state)
    if (path === '/api/auth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookie = request.headers.get('cookie') || '';
      const stateMatch = cookie.match(/oauth_state=([^;]+)/);

      if (!code || !state || !stateMatch || stateMatch[1] !== state) {
        return Response.redirect(`${url.origin}/validate?auth_error=invalid_state`, 302);
      }

      try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) {
          log.error(`[${new Date().toISOString()}] OAuth token exchange failed:`, tokenData.error);
          return Response.redirect(`${url.origin}/validate?auth_error=token_failed`, 302);
        }

        // Fetch user info
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'User-Agent': 'ReactDrop/1.0',
          },
        });

        const user = await userResponse.json() as GitHubUser;
        log.info(`[${new Date().toISOString()}] ✅ OAuth login: ${user.login} (${user.id})`);

        // Set user info as a signed cookie (HMAC + base64, HTTP-only)
        const userPayload = JSON.stringify({
          login: user.login,
          avatar_url: user.avatar_url,
          id: user.id,
        });
        const encodedUser = btoa(userPayload);
        const signature = await signCookie(encodedUser, env.GITHUB_CLIENT_SECRET);

        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${url.origin}/validate`,
            'Set-Cookie': `gh_user=${encodedUser}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
            ...securityHeaders,
          },
        });
      } catch (error) {
        log.error(`[${new Date().toISOString()}] 💥 OAuth error:`, error);
        return Response.redirect(`${url.origin}/validate?auth_error=server_error`, 302);
      }
    }

    // GitHub OAuth: get current user from cookie
    if (path === '/api/auth/me') {
      const cookie = request.headers.get('cookie') || '';
      const match = cookie.match(/gh_user=([^;]+)/);
      if (!match) {
        return Response.json({ authenticated: false }, { headers: corsHeaders });
      }

      try {
        const parts = match[1].split('.');
        if (parts.length !== 2) {
          return Response.json({ authenticated: false }, { headers: corsHeaders });
        }
        const [payload, sig] = parts;
        const expectedSig = await signCookie(payload, env.GITHUB_CLIENT_SECRET);
        if (sig !== expectedSig) {
          return Response.json({ authenticated: false }, { headers: corsHeaders });
        }
        const user = JSON.parse(atob(payload));
        return Response.json({ authenticated: true, user }, { headers: corsHeaders });
      } catch {
        return Response.json({ authenticated: false }, { headers: corsHeaders });
      }
    }

    // GitHub OAuth: logout
    if (path === '/api/auth/logout') {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${url.origin}/validate`,
          'Set-Cookie': 'gh_user=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
          ...securityHeaders,
        },
      });
    }

    // API endpoints
    if (path.startsWith("/api/")) {
      if (path === "/api/recent") {
        const gists = await getRecentGists(env);
        return Response.json(gists, { headers: corsHeaders });
      }
      
      if (path === "/api/popular") {
        const gists = await getPopularGists(env);
        return Response.json(gists, { headers: corsHeaders });
      }
      
      if (path === "/api/update-share-id" && request.method === "POST") {
        try {
          const body = await request.json() as { gistId?: string; oldShareId?: string; newShareId?: string };
          const { gistId, oldShareId, newShareId } = body;
          
          if (!gistId || !oldShareId || !newShareId) {
            return Response.json({ error: 'Missing required fields: gistId, oldShareId, newShareId' }, { status: 400 });
          }
          
          // Get the filename for this gist
          const stored = await env.DB.prepare(`
            SELECT filename FROM stored_gists 
            WHERE original_gist_id = ? AND share_id = ?
          `).bind(gistId, oldShareId).first();
          
          if (!stored) {
            return Response.json({ error: 'Share ID not found' }, { status: 404 });
          }
          
          await updateShareId(env, gistId, stored.filename as string, oldShareId, newShareId);
          
          log.info(`[${new Date().toISOString()}] ✅ Successfully updated share ID: ${oldShareId} -> ${newShareId}`);
          return Response.json({ success: true, newShareId }, { headers: corsHeaders });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          log.error(`[${new Date().toISOString()}] 💥 Update share ID failed:`, errorMessage);
          return Response.json({ error: errorMessage }, { status: 400 });
        }
      }

      if (path === "/api/report" && request.method === "POST") {
        try {
          const body = await request.json() as { gistId?: string; shareId?: string; reason?: string };
          const { gistId: reportGistId, shareId: reportShareId, reason } = body;

          if (!reportGistId || !reason || reason.length < 3) {
            return Response.json({ error: 'gistId and reason (min 3 chars) required' }, { status: 400, headers: corsHeaders });
          }

          await env.DB.prepare(`
            INSERT INTO abuse_reports (gist_id, share_id, reporter_ip, reason)
            VALUES (?, ?, ?, ?)
          `).bind(reportGistId, reportShareId || null, clientIP, reason.substring(0, 500)).run();

          return Response.json({ success: true }, { headers: corsHeaders });
        } catch (error) {
          return Response.json({ error: 'Failed to submit report' }, { status: 500, headers: corsHeaders });
        }
      }

      // Search components
      if (path === "/api/search" && request.method === "GET") {
        const query = url.searchParams.get('q');
        if (!query || query.length < 2) {
          return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400, headers: corsHeaders });
        }

        try {
          // Try FTS5 first, fall back to LIKE search
          let results;
          try {
            results = await env.DB.prepare(`
              SELECT s.share_id, s.filename, s.description, s.source, s.uploaded_by,
                     a.view_count, a.first_accessed_at
              FROM component_search cs
              JOIN stored_gists s ON s.id = cs.rowid
              LEFT JOIN gist_analytics a ON a.gist_id = s.original_gist_id AND a.filename = s.filename
              WHERE component_search MATCH ?
              ORDER BY rank
              LIMIT 20
            `).bind(query).all();
          } catch {
            // FTS table might not exist yet, fall back to LIKE
            results = await env.DB.prepare(`
              SELECT s.share_id, s.filename, s.description, s.source, s.uploaded_by,
                     a.view_count, a.first_accessed_at
              FROM stored_gists s
              LEFT JOIN gist_analytics a ON a.gist_id = s.original_gist_id AND a.filename = s.filename
              WHERE s.filename LIKE ? OR s.description LIKE ?
              ORDER BY a.view_count DESC
              LIMIT 20
            `).bind(`%${query}%`, `%${query}%`).all();
          }

          return Response.json(results.results, { headers: corsHeaders });
        } catch (error) {
          log.error('Search failed', error);
          return Response.json({ error: 'Search failed' }, { status: 500, headers: corsHeaders });
        }
      }

      // Direct upload (requires authentication)
      if (path === "/api/upload" && request.method === "POST") {
        // Verify auth cookie
        const cookie = request.headers.get('cookie') || '';
        const authMatch = cookie.match(/gh_user=([^;]+)/);
        if (!authMatch) {
          return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
        }

        let username: string;
        try {
          const parts = authMatch[1].split('.');
          if (parts.length !== 2) throw new Error('Invalid cookie');
          const [payload, sig] = parts;
          const expectedSig = await signCookie(payload, env.GITHUB_CLIENT_SECRET);
          if (sig !== expectedSig) throw new Error('Invalid signature');
          const user = JSON.parse(atob(payload));
          username = user.login;
        } catch {
          return Response.json({ error: 'Invalid authentication' }, { status: 401, headers: corsHeaders });
        }

        try {
          const body = await request.json() as { content?: string; filename?: string; description?: string };
          const { content, filename, description } = body;

          if (!content || !filename) {
            return Response.json({ error: 'content and filename are required' }, { status: 400, headers: corsHeaders });
          }

          if (content.length > 50 * 1024) {
            return Response.json({ error: 'Content exceeds 50KB limit' }, { status: 400, headers: corsHeaders });
          }

          if (!filename.endsWith('.tsx')) {
            return Response.json({ error: 'Filename must end with .tsx' }, { status: 400, headers: corsHeaders });
          }

          // Generate share ID
          let shareId = generateShareId();
          let attempts = 0;
          while (attempts < 10) {
            const collision = await env.DB.prepare(
              'SELECT share_id FROM stored_gists WHERE share_id = ?'
            ).bind(shareId).first();
            if (!collision) break;
            shareId = generateShareId();
            attempts++;
          }

          // Store as upload (no original gist ID)
          const uploadGistId = `upload-${username}-${Date.now()}`;
          await env.DB.prepare(`
            INSERT INTO stored_gists (share_id, original_gist_id, filename, content, description, source, uploaded_by)
            VALUES (?, ?, ?, ?, ?, 'upload', ?)
          `).bind(shareId, uploadGistId, filename, content, description || '', username).run();

          // Track analytics
          await updateAnalytics(env, uploadGistId, filename, true);

          log.info(`Uploaded component by ${username}: ${shareId}`);
          return Response.json({
            success: true,
            shareId,
            shareUrl: `${url.origin}/share/${shareId}`,
            uploadedBy: username,
          }, { headers: corsHeaders });
        } catch (error) {
          log.error('Upload failed', error);
          return Response.json({ error: 'Upload failed' }, { status: 500, headers: corsHeaders });
        }
      }

      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }

    // Serve SPA for /validate route
    if (path === '/validate') {
      try {
        const indexResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
        if (indexResponse.ok) {
          return new Response(indexResponse.body, {
            headers: {
              ...Object.fromEntries(indexResponse.headers),
              'Content-Type': 'text/html'
            }
          });
        }
      } catch (error) {
        log.error(`[${new Date().toISOString()}] 💥 Error serving validate page:`, error);
      }
    }

    // Handle shareable links with /share/ prefix
    if (path.startsWith('/share/')) {
      const shareId = path.slice(7); // Remove '/share/' prefix
      log.info(`[${new Date().toISOString()}] 🔗 Processing share request for: ${shareId}`);
      
      if (shareId && shareId.length >= 3 && shareId.length <= 50 && /^[a-zA-Z0-9-_]+$/.test(shareId)) {
        // Check Accept header to see if API request or browser visit
        const acceptHeader = request.headers.get('accept') || '';
        const isApiRequest = acceptHeader.includes('application/json') || 
                            request.headers.get('x-requested-with') === 'XMLHttpRequest';
        
        if (isApiRequest) {
          const storedGist = await getStoredGist(env, shareId);
          
          if (!storedGist) {
            log.info(`[${new Date().toISOString()}] 🚫 Share ID ${shareId} not found`);
            const duration = Date.now() - requestStart.getTime();
            log.info(`[${new Date().toISOString()}] ⏱️  Request completed in ${duration}ms (404)`);
            return Response.json({ error: 'Shared component not found' }, { status: 404 });
          }
          
          const duration = Date.now() - requestStart.getTime();
          log.info(`[${new Date().toISOString()}] 🎉 Successfully served stored gist ${shareId} in ${duration}ms`);
          
          return Response.json({
            content: storedGist.content,
            filename: storedGist.filename,
            gistId: storedGist.originalGistId,
            shareId: shareId,
            isShared: true
          }, {
            headers: corsHeaders
          });
        }
        // For browser visits to share URLs, serve the React app (fall through)
        log.info(`[${new Date().toISOString()}] 🌐 Direct browser visit to share ${shareId} - serving React app`);
      }
    }

    // Handle direct gist IDs or any other SPA routes
    const pathId = path.slice(1); // Remove leading slash
    if (pathId && pathId.length >= 32 && /^[a-fA-F0-9]+$/.test(pathId)) {
      log.info(`[${new Date().toISOString()}] 🎯 Processing gist request for: ${pathId}`);
      
      const gistId = pathId;
      
      // Check if this is an API request (from React app) or direct browser navigation
      const acceptHeader = request.headers.get('accept') || '';
      const isApiRequest = acceptHeader.includes('application/json') || 
                          request.headers.get('x-requested-with') === 'XMLHttpRequest';
      
      log.info(`[${new Date().toISOString()}] 📝 Request type: ${isApiRequest ? 'API' : 'Browser'} (Accept: ${acceptHeader})`);
      
      if (isApiRequest) {
        // This is an API request from the React app - return JSON data
        const component = await fetchGistComponent(gistId, env);
        
        if (!component) {
          log.info(`[${new Date().toISOString()}] 🚫 Gist ${gistId} not found or invalid`);
          await updateAnalytics(env, gistId, 'unknown', false, 'Gist not found or no .tsx file');
          const duration = Date.now() - requestStart.getTime();
          log.info(`[${new Date().toISOString()}] ⏱️  Request completed in ${duration}ms (404)`);
          return Response.json({ error: 'Gist not found or does not contain a .tsx file' }, { status: 404 });
        }

        // Store the gist for sharing and get share ID
        let shareId: string | null = null;
        try {
          shareId = await storeGistForSharing(env, gistId, component.filename, component.content, component.description || '');
          log.info(`[${new Date().toISOString()}] 🔗 Generated share ID for ${gistId}: ${shareId}`);
        } catch (error) {
          log.error(`[${new Date().toISOString()}] ⚠️  Failed to generate share ID for ${gistId}:`, error);
          // Continue without share ID - not critical
        }

        await updateAnalytics(env, gistId, component.filename, true);
        
        const duration = Date.now() - requestStart.getTime();
        log.info(`[${new Date().toISOString()}] 🎉 Successfully served gist ${gistId}/${component.filename} in ${duration}ms`);
        
        return Response.json({
          content: component.content,
          filename: component.filename,
          description: component.description || null,
          gistId: gistId,
          shareId: shareId,
          fromCache: component.fromCache || false
        }, {
          headers: corsHeaders
        });
      }
      // For direct browser visits to gist URLs, fall through to serve SPA
      log.info(`[${new Date().toISOString()}] 🌐 Direct browser visit to gist ${gistId} - serving React app`);
    }

    // For any other routes that might be SPA routes, serve index.html
    try {
      const indexResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
      if (indexResponse.ok) {
        log.info(`[${new Date().toISOString()}] 🌐 Serving index.html for SPA route: ${path}`);
        return new Response(indexResponse.body, {
          headers: {
            ...Object.fromEntries(indexResponse.headers),
            'Content-Type': 'text/html'
          }
        });
      }
    } catch (error) {
      log.error(`[${new Date().toISOString()}] 💥 Error serving index.html for route ${path}:`, error);
    }
    
    // Last resort - try to serve the requested asset directly
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.ok) {
        log.info(`[${new Date().toISOString()}] 📁 Served static asset: ${path}`);
        return assetResponse;
      }
    } catch (error) {
      log.error(`[${new Date().toISOString()}] 💥 Error serving static asset ${path}:`, error);
    }
    
    const duration = Date.now() - requestStart.getTime();
    log.info(`[${new Date().toISOString()}] 🚫 Route not found: ${path} (${duration}ms)`);
    
    return new Response('Not Found', { status: 404 });
  },

  // Scheduled backup: runs daily via Cloudflare cron trigger
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const log = createLogger();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      // Export all tables as JSON
      const tables = ['gist_analytics', 'stored_gists', 'abuse_reports'];
      const backup: Record<string, unknown[]> = {};

      for (const table of tables) {
        try {
          const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
          backup[table] = result.results;
        } catch {
          backup[table] = [];
        }
      }

      const backupJson = JSON.stringify(backup, null, 2);
      const key = `backups/${timestamp}.json`;

      await env.BACKUPS.put(key, backupJson, {
        customMetadata: {
          tables: tables.join(','),
          recordCount: String(Object.values(backup).reduce((sum, t) => sum + t.length, 0)),
          timestamp,
        },
      });

      // Keep only last 30 backups
      const list = await env.BACKUPS.list({ prefix: 'backups/' });
      if (list.objects.length > 30) {
        const toDelete = list.objects
          .sort((a, b) => a.uploaded.getTime() - b.uploaded.getTime())
          .slice(0, list.objects.length - 30);
        for (const obj of toDelete) {
          await env.BACKUPS.delete(obj.key);
        }
      }

      log.info(`Backup complete: ${key} (${backupJson.length} bytes)`);
    } catch (error) {
      log.error('Backup failed', error);
    }
  },
} satisfies ExportedHandler<Env>;
