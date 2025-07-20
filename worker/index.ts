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

async function fetchGistComponent(gistId: string, env: Env): Promise<{ content: string; filename: string } | null> {
  const cache = caches.default;
  const cacheKey = `https://cache.gist-hoster.internal/gist/${gistId}`;
  
  // Check cache first
  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const cached = await cachedResponse.json() as { content: string; filename: string };
    return cached;
  }

  try {
    // Fetch from GitHub API
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; Gist-Hoster/1.0)',
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Remove token authentication for now
    // if (env.GITHUB_TOKEN) {
    //   headers['Authorization'] = `token ${env.GITHUB_TOKEN}`;
    // }
    
    const response = await fetch(`https://api.github.com/gists/${gistId}`, { 
      headers,
      redirect: 'follow'
    });
    
    console.log(`Fetching gist ${gistId}, status: ${response.status}`);
    console.log(`Rate limit remaining: ${response.headers.get('x-ratelimit-remaining')}`);
    console.log(`Rate limit reset: ${response.headers.get('x-ratelimit-reset')}`);
    
    if (!response.ok) {
      console.log(`Gist fetch failed: ${response.status} - ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Error response: ${errorText}`);
      if (response.status === 404) {
        // Cache 404s for 5 minutes
        const notFoundResponse = Response.json({ error: 'Gist not found' }, { status: 404 });
        notFoundResponse.headers.set('Cache-Control', 'max-age=300');
        await cache.put(cacheKey, notFoundResponse.clone());
      }
      return null;
    }

    const gist: GistResponse = await response.json();
    
    // Find first .tsx file
    const files = Object.values(gist.files);
    console.log(`Found files: ${files.map(f => f.filename).join(', ')}`);
    
    const tsxFile = files.find(file => file.filename.endsWith('.tsx'));
    
    if (!tsxFile) {
      console.log('No .tsx file found');
      return null;
    }
    
    console.log(`Found .tsx file: ${tsxFile.filename}`);

    const result = {
      content: tsxFile.content,
      filename: tsxFile.filename
    };

    // Cache for 1 hour
    const cacheResponse = Response.json(result);
    cacheResponse.headers.set('Cache-Control', 'max-age=3600');
    await cache.put(cacheKey, cacheResponse.clone());

    return result;
  } catch (error) {
    console.error('Error fetching gist:', error);
    return null;
  }
}

async function updateAnalytics(env: Env, gistId: string, filename: string, success: boolean, error?: string) {
  try {
    if (success) {
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          view_count = view_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count, error_count, last_error)
        VALUES (?, ?, 0, 1, ?)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          error_count = error_count + 1,
          last_error = ?,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename, error, error).run();
    }
  } catch (dbError) {
    console.error('Database error:', dbError);
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
    const url = new URL(request.url);
    const path = url.pathname;

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
        return Response.json(gists);
      }
      
      if (path === "/api/popular") {
        const gists = await getPopularGists(env);
        return Response.json(gists);
      }

      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }

    // Gist component endpoint
    const gistId = path.slice(1); // Remove leading slash
    if (gistId && gistId.length > 0 && !gistId.includes('/')) {
      const component = await fetchGistComponent(gistId, env);
      
      if (!component) {
        await updateAnalytics(env, gistId, 'unknown', false, 'Gist not found or no .tsx file');
        return Response.json({ error: 'Gist not found or does not contain a .tsx file' }, { status: 404 });
      }

      await updateAnalytics(env, gistId, component.filename, true);
      
      return Response.json({
        content: component.content,
        filename: component.filename,
        gistId: gistId
      });
    }

    // Fallback to static assets
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
