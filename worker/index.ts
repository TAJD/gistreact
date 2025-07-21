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


async function fetchGistComponent(gistId: string, _env: Env): Promise<{ content: string; filename: string } | null> {
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
      filename: tsxFile.filename
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

      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }

    // Gist component endpoint
    const gistId = path.slice(1); // Remove leading slash
    if (gistId && gistId.length > 0 && !gistId.includes('/')) {
      console.log(`[${new Date().toISOString()}] 🎯 Processing gist request: ${gistId}`);
      
      const component = await fetchGistComponent(gistId, env);
      
      if (!component) {
        console.log(`[${new Date().toISOString()}] 🚫 Gist ${gistId} not found or invalid`);
        await updateAnalytics(env, gistId, 'unknown', false, 'Gist not found or no .tsx file');
        const duration = Date.now() - requestStart.getTime();
        console.log(`[${new Date().toISOString()}] ⏱️  Request completed in ${duration}ms (404)`);
        return Response.json({ error: 'Gist not found or does not contain a .tsx file' }, { status: 404 });
      }

      await updateAnalytics(env, gistId, component.filename, true);
      
      const duration = Date.now() - requestStart.getTime();
      console.log(`[${new Date().toISOString()}] 🎉 Successfully served gist ${gistId}/${component.filename} in ${duration}ms`);
      
      return Response.json({
        content: component.content,
        filename: component.filename,
        gistId: gistId
      }, {
        headers: corsHeaders
      });
    }

    // Fallback to static assets  
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
