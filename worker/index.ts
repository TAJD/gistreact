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
      console.log(`[${timestamp}] 🔗 Using existing share ID for ${gistId}/${filename}: ${existing.share_id}`);
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
      console.error(`[${timestamp}] 💥 Could not generate unique share ID after 10 attempts`);
      throw new Error('Could not generate unique share ID');
    }
    
    // Store the gist
    await env.DB.prepare(`
      INSERT INTO stored_gists (share_id, original_gist_id, filename, content, description)
      VALUES (?, ?, ?, ?, ?)
    `).bind(shareId, gistId, filename, content, description).run();
    
    console.log(`[${timestamp}] ✅ Stored gist ${gistId}/${filename} with share ID: ${shareId}`);
    return shareId;
  } catch (error) {
    console.error(`[${timestamp}] 💥 Error storing gist for sharing:`, error);
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
      console.log(`[${timestamp}] 🚫 No rows updated for ${gistId}/${filename} ${oldShareId} -> ${newShareId}`);
      throw new Error('Share ID not found or could not be updated');
    }
    
    console.log(`[${timestamp}] ✅ Updated share ID for ${gistId}/${filename}: ${oldShareId} -> ${newShareId}`);
    return true;
  } catch (error) {
    console.error(`[${timestamp}] 💥 Error updating share ID:`, error);
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
      console.log(`[${timestamp}] 🚫 No stored gist found for share ID: ${shareId}`);
      return null;
    }
    
    // Update access count
    await env.DB.prepare(`
      UPDATE stored_gists 
      SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE share_id = ?
    `).bind(shareId).run();
    
    console.log(`[${timestamp}] 🎯 Retrieved stored gist for share ID: ${shareId}`);
    return {
      content: result.content as string,
      filename: result.filename as string,
      originalGistId: result.original_gist_id as string
    };
  } catch (error) {
    console.error(`[${timestamp}] 💥 Error retrieving stored gist:`, error);
    return null;
  }
}


async function fetchGistComponent(gistId: string, _env: Env): Promise<{ content: string; filename: string; description: string } | null> {
  const startTime = new Date();
  const timestamp = startTime.toISOString();
  
  console.log(`[${timestamp}] 🚀 Starting gist fetch for ID: ${gistId}`);
  
  try {
    // Fetch from GitHub API
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; GistReact/1.0)',
      'Accept': 'application/vnd.github.v3+json'
    };
    
    const response = await fetch(`https://api.github.com/gists/${gistId}`, { 
      headers,
      redirect: 'follow'
    });
    
    const fetchDuration = Date.now() - startTime.getTime();
    console.log(`[${new Date().toISOString()}] 📡 GitHub API response for ${gistId}: ${response.status} (${fetchDuration}ms)`);
    console.log(`[${new Date().toISOString()}] 📊 Rate limit remaining: ${response.headers.get('x-ratelimit-remaining')}`);
    console.log(`[${new Date().toISOString()}] 🔄 Rate limit reset: ${new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000).toISOString()}`);
    
    if (!response.ok) {
      console.log(`[${new Date().toISOString()}] ❌ Gist fetch failed for ${gistId}: ${response.status} - ${response.statusText}`);
      const errorText = await response.text();
      console.log(`[${new Date().toISOString()}] 📝 Error details: ${errorText}`);
      return null;
    }

    const gist: GistResponse = await response.json();
    
    // Find first .tsx file
    const files = Object.values(gist.files);
    console.log(`[${new Date().toISOString()}] 📁 Files in gist ${gistId}: [${files.map(f => f.filename).join(', ')}]`);
    
    const tsxFile = files.find(file => file.filename.endsWith('.tsx'));
    
    if (!tsxFile) {
      console.log(`[${new Date().toISOString()}] ⚠️  No .tsx file found in gist ${gistId}`);
      return null;
    }
    
    const totalDuration = Date.now() - startTime.getTime();
    const contentLength = tsxFile.content.length;
    console.log(`[${new Date().toISOString()}] ✅ Successfully loaded gist ${gistId}`);
    console.log(`[${new Date().toISOString()}] 📄 File: ${tsxFile.filename} (${contentLength} characters)`);
    console.log(`[${new Date().toISOString()}] ⏱️  Total processing time: ${totalDuration}ms`);
    console.log(`[${new Date().toISOString()}] 🎯 Gist created: ${gist.created_at}, updated: ${gist.updated_at}`);

    return {
      content: tsxFile.content,
      filename: tsxFile.filename,
      description: gist.description
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime.getTime();
    console.error(`[${new Date().toISOString()}] 💥 Fatal error fetching gist ${gistId} after ${totalDuration}ms:`, error);
    return null;
  }
}

async function updateAnalytics(env: Env, gistId: string, filename: string, success: boolean, error?: string) {
  const timestamp = new Date().toISOString();
  
  try {
    if (success) {
      console.log(`[${timestamp}] 📈 Recording successful view for ${gistId}/${filename}`);
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          view_count = view_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename).run();
      console.log(`[${timestamp}] ✅ Analytics updated successfully for ${gistId}/${filename}`);
    } else {
      console.log(`[${timestamp}] 📉 Recording error for ${gistId}/${filename}: ${error}`);
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count, error_count, last_error)
        VALUES (?, ?, 0, 1, ?)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          error_count = error_count + 1,
          last_error = ?,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename, error, error).run();
      console.log(`[${timestamp}] ⚠️  Error analytics updated for ${gistId}/${filename}`);
    }
  } catch (dbError) {
    console.error(`[${timestamp}] 💥 Database error for ${gistId}/${filename}:`, dbError);
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
    console.error('Database error:', error);
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
    console.error('Database error:', error);
    return [];
  }
}

export default {
  async fetch(request, env) {
    const requestStart = new Date();
    const timestamp = requestStart.toISOString();
    const url = new URL(request.url);
    const path = url.pathname;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    
    console.log(`[${timestamp}] 🌐 ${request.method} ${path} - IP: ${clientIP} - UA: ${userAgent.substring(0, 100)}`);
    
    // Add no-cache headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Proxy endpoint for external resources
    if (path.startsWith("/proxy")) {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return Response.json({ error: 'Missing url parameter' }, { status: 400 });
      }

      try {
        const proxyResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Gist-Hoster/1.0'
          }
        });
        
        const response = new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: proxyResponse.headers
        });
        
        // Add CORS headers
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        return response;
      } catch (error) {
        return Response.json({ error: 'Proxy request failed' }, { status: 500 });
      }
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
          
          console.log(`[${new Date().toISOString()}] ✅ Successfully updated share ID: ${oldShareId} -> ${newShareId}`);
          return Response.json({ success: true, newShareId }, { headers: corsHeaders });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error(`[${new Date().toISOString()}] 💥 Update share ID failed:`, errorMessage);
          return Response.json({ error: errorMessage }, { status: 400 });
        }
      }

      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }

    // Check if this looks like a share ID (8 chars) or gist ID (32 chars)
    const pathId = path.slice(1); // Remove leading slash
    if (pathId && pathId.length > 0 && !pathId.includes('/')) {
      console.log(`[${new Date().toISOString()}] 🎯 Processing request for: ${pathId}`);
      
      // Check if this is a stored gist share ID (shorter than typical gist ID)
      if (pathId.length <= 50 && pathId.length >= 3 && /^[a-zA-Z0-9-_]+$/.test(pathId)) {
        console.log(`[${new Date().toISOString()}] 🔗 Looks like a share ID: ${pathId}`);
        
        // Check Accept header to see if API request or browser visit
        const acceptHeader = request.headers.get('accept') || '';
        const isApiRequest = acceptHeader.includes('application/json') || 
                            request.headers.get('x-requested-with') === 'XMLHttpRequest';
        
        if (isApiRequest) {
          const storedGist = await getStoredGist(env, pathId);
          
          if (!storedGist) {
            console.log(`[${new Date().toISOString()}] 🚫 Share ID ${pathId} not found`);
            const duration = Date.now() - requestStart.getTime();
            console.log(`[${new Date().toISOString()}] ⏱️  Request completed in ${duration}ms (404)`);
            return Response.json({ error: 'Shared component not found' }, { status: 404 });
          }
          
          const duration = Date.now() - requestStart.getTime();
          console.log(`[${new Date().toISOString()}] 🎉 Successfully served stored gist ${pathId} in ${duration}ms`);
          
          return Response.json({
            content: storedGist.content,
            filename: storedGist.filename,
            gistId: storedGist.originalGistId,
            shareId: pathId,
            isShared: true
          }, {
            headers: corsHeaders
          });
        } else {
          // For browser visits to share IDs, we still need to serve the React app
          // Let the frontend handle the routing
          console.log(`[${new Date().toISOString()}] 🌐 Direct browser visit to share ID ${pathId} - serving React app`);
        }
      }
      
      // Regular gist ID (32 chars or longer)
      const gistId = pathId;
      
      // Check if this is an API request (from React app) or direct browser navigation
      const acceptHeader = request.headers.get('accept') || '';
      const isApiRequest = acceptHeader.includes('application/json') || 
                          request.headers.get('x-requested-with') === 'XMLHttpRequest';
      
      console.log(`[${new Date().toISOString()}] 📝 Request type: ${isApiRequest ? 'API' : 'Browser'} (Accept: ${acceptHeader})`);
      
      if (isApiRequest) {
        // This is an API request from the React app - return JSON data
        const component = await fetchGistComponent(gistId, env);
        
        if (!component) {
          console.log(`[${new Date().toISOString()}] 🚫 Gist ${gistId} not found or invalid`);
          await updateAnalytics(env, gistId, 'unknown', false, 'Gist not found or no .tsx file');
          const duration = Date.now() - requestStart.getTime();
          console.log(`[${new Date().toISOString()}] ⏱️  Request completed in ${duration}ms (404)`);
          return Response.json({ error: 'Gist not found or does not contain a .tsx file' }, { status: 404 });
        }

        // Store the gist for sharing and get share ID
        let shareId: string | null = null;
        try {
          shareId = await storeGistForSharing(env, gistId, component.filename, component.content, component.description || '');
          console.log(`[${new Date().toISOString()}] 🔗 Generated share ID for ${gistId}: ${shareId}`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ⚠️  Failed to generate share ID for ${gistId}:`, error);
          // Continue without share ID - not critical
        }

        await updateAnalytics(env, gistId, component.filename, true);
        
        const duration = Date.now() - requestStart.getTime();
        console.log(`[${new Date().toISOString()}] 🎉 Successfully served gist ${gistId}/${component.filename} in ${duration}ms`);
        
        return Response.json({
          content: component.content,
          filename: component.filename,
          gistId: gistId,
          shareId: shareId
        }, {
          headers: corsHeaders
        });
      } else {
        // This is a direct browser visit - serve the React app HTML
        console.log(`[${new Date().toISOString()}] 🌐 Direct browser visit to gist ${gistId} - serving React app`);
        
        // Serve index.html for SPA routing
        try {
          const indexResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
          if (indexResponse.ok) {
            console.log(`[${new Date().toISOString()}] ✅ Served index.html for gist ${gistId}`);
            return new Response(indexResponse.body, {
              headers: {
                ...Object.fromEntries(indexResponse.headers),
                'Content-Type': 'text/html'
              }
            });
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] 💥 Error serving index.html:`, error);
        }
      }
    }

    // For any other routes that might be SPA routes, serve index.html
    try {
      const indexResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
      if (indexResponse.ok) {
        console.log(`[${new Date().toISOString()}] 🌐 Serving index.html for SPA route: ${path}`);
        return new Response(indexResponse.body, {
          headers: {
            ...Object.fromEntries(indexResponse.headers),
            'Content-Type': 'text/html'
          }
        });
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 💥 Error serving index.html for route ${path}:`, error);
    }
    
    // Last resort - try to serve the requested asset directly
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.ok) {
        console.log(`[${new Date().toISOString()}] 📁 Served static asset: ${path}`);
        return assetResponse;
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 💥 Error serving static asset ${path}:`, error);
    }
    
    const duration = Date.now() - requestStart.getTime();
    console.log(`[${new Date().toISOString()}] 🚫 Route not found: ${path} (${duration}ms)`);
    
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
