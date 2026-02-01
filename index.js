/**
 * Cloudflare Worker URL Shortener
 * Zero CSS, simple interface with Supabase backend
 */

// Helper: Generate random short code
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper: Basic Auth verification
function verifyBasicAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
  const base64Credentials = authHeader.substring(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');
  
  return username === env.BASIC_AUTH_USER && password === env.BASIC_AUTH_PASS;
}

// Helper: API Key verification
function verifyApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === env.API_SECRET;
}

// Helper: Require Basic Auth (returns 401 response if not authenticated)
function requireBasicAuth() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="URL Shortener"'
    }
  });
}

// Supabase API helper
async function supabaseQuery(env, query, params = []) {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/${query}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(params)
  });
  
  return response;
}

// Supabase REST API helpers
async function insertShortUrl(env, shortCode, originalUrl) {
  const url = `${env.SUPABASE_URL}/rest/v1/short_urls`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      short_code: shortCode,
      original_url: originalUrl
    })
  });
  
  return response;
}

async function getShortUrl(env, shortCode) {
  const url = `${env.SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${shortCode}&select=*`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`
    }
  });
  
  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

async function deleteShortUrl(env, shortCode) {
  const url = `${env.SUPABASE_URL}/rest/v1/short_urls?short_code=eq.${shortCode}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`
    }
  });
  
  return response;
}

// Route Handlers

function handleIndex() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortener</title>
</head>
<body>
  <h1>Welcome To your stay.</h1>
  <p>Please message the host if you lost the link.</p>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleShortUI(request, env) {
  // Verify basic auth
  if (!verifyBasicAuth(request, env)) {
    return requireBasicAuth();
  }
  
  // Handle POST request (form submission)
  if (request.method === 'POST') {
    const formData = await request.formData();
    const originalUrl = formData.get('url');
    const customCode = formData.get('custom_code');
    
    if (!originalUrl) {
      return new Response('URL is required', { status: 400 });
    }
    
    // Use custom code or generate random one, with retry logic for random codes
    let shortCode = customCode || generateShortCode();
    const maxRetries = 5;
    let retries = 0;
    
    try {
      let response;
      
      // Retry loop for random codes (not custom codes)
      while (retries < maxRetries) {
        response = await insertShortUrl(env, shortCode, originalUrl);
        
        // Success
        if (response.ok) {
          break;
        }
        
        // Check if it's a duplicate error
        const errorText = await response.text();
        const isDuplicate = errorText.includes('duplicate') || errorText.includes('unique');
        
        // If custom code and duplicate, show error (don't retry)
        if (customCode && isDuplicate) {
          return new Response(`Error: Short code "${customCode}" already exists. Please choose a different code.`, { status: 400 });
        }
        
        // If random code and duplicate, retry with new code
        if (!customCode && isDuplicate && retries < maxRetries - 1) {
          shortCode = generateShortCode();
          retries++;
          continue;
        }
        
        // Other errors, or max retries reached
        return new Response(`Error creating short URL: ${errorText}`, { status: 400 });
      }
      
      const data = await response.json();
      const shortUrl = `${new URL(request.url).origin}/${shortCode}`;
      
      // Success page
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL Shortened</title>
</head>
<body>
  <h1>URL Shortened Successfully!</h1>
  <p><strong>Short URL:</strong> <a href="${shortUrl}">${shortUrl}</a></p>
  <p><strong>Original URL:</strong> ${originalUrl}</p>
  <p><a href="/short">Create another</a></p>
</body>
</html>
      `;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
      
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
  
  // GET request - show form
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Short URL</title>
</head>
<body>
  <h1>URL Shortener</h1>
  <form method="POST">
    <div>
      <label for="url">Original URL:</label><br>
      <input type="url" id="url" name="url" required size="50" placeholder="https://example.com">
    </div>
    <br>
    <div>
      <label for="custom_code">Custom Short Code (optional):</label><br>
      <input type="text" id="custom_code" name="custom_code" size="20" placeholder="Leave empty for random">
    </div>
    <br>
    <button type="submit">Shorten URL</button>
  </form>
  <br>
  <p><a href="/api-docs">View API Documentation</a></p>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleApiShort(request, env) {
  // Verify API key
  if (!verifyApiKey(request, env)) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  // POST - Create new short URL
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { url: originalUrl, custom_code } = body;
      
      if (!originalUrl) {
        return new Response(JSON.stringify({ error: 'url is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Use custom code or generate random one, with retry logic for random codes
      let shortCode = custom_code || generateShortCode();
      const maxRetries = 5;
      let retries = 0;
      
      let response;
      
      // Retry loop for random codes (not custom codes)
      while (retries < maxRetries) {
        response = await insertShortUrl(env, shortCode, originalUrl);
        
        // Success
        if (response.ok) {
          break;
        }
        
        // Check if it's a duplicate error
        const errorText = await response.text();
        const isDuplicate = errorText.includes('duplicate') || errorText.includes('unique');
        
        // If custom code and duplicate, show error (don't retry)
        if (custom_code && isDuplicate) {
          return new Response(JSON.stringify({ error: `Short code "${custom_code}" already exists. Please choose a different code.` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // If random code and duplicate, retry with new code
        if (!custom_code && isDuplicate && retries < maxRetries - 1) {
          shortCode = generateShortCode();
          retries++;
          continue;
        }
        
        // Other errors, or max retries reached
        return new Response(JSON.stringify({ error: `Failed to create short URL: ${errorText}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const data = await response.json();
      const shortUrl = `${url.origin}/${shortCode}`;
      
      return new Response(JSON.stringify({
        success: true,
        short_code: shortCode,
        short_url: shortUrl,
        original_url: originalUrl
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // GET - Get short URL info
  if (request.method === 'GET' && code) {
    try {
      const data = await getShortUrl(env, code);
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'Short URL not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // DELETE - Delete short URL
  if (request.method === 'DELETE' && code) {
    try {
      await deleteShortUrl(env, code);
      
      return new Response(JSON.stringify({ success: true, message: 'Short URL deleted' }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response(JSON.stringify({ error: 'Invalid request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleRedirect(request, env, shortCode) {
  try {
    const data = await getShortUrl(env, shortCode);
    
    if (!data) {
      return handle404();
    }
    
    // Redirect to original URL
    return Response.redirect(data.original_url, 302);
    
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

function handle404() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Not Found</title>
</head>
<body>
  <h1>404 - Not Found</h1>
  <p>The short URL you're looking for doesn't exist.</p>
  <p><a href="/">Go home</a></p>
</body>
</html>
  `;
  
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html' }
  });
}

function handleApiDocs(request) {
  const origin = new URL(request.url).origin;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
</head>
<body>
  <h1>URL Shortener API Documentation</h1>
  <p><a href="/short">← Back to URL Shortener</a></p>
  
  <hr>
  
  <p>Use the API endpoint at <code>/api-short</code> to programmatically manage short URLs.</p>
  <p><strong>Authentication:</strong> All API requests require the <code>X-API-Key</code> header.</p>
  
  <h2>1. Create Short URL</h2>
  <p><strong>Endpoint:</strong> <code>POST ${origin}/api-short</code></p>
  <p><strong>Headers:</strong></p>
  <pre>X-API-Key: your-api-secret
Content-Type: application/json</pre>
  <p><strong>Request Body:</strong></p>
  <pre>{
  "url": "https://example.com/very/long/url",
  "custom_code": "mylink"  // optional, omit for random code
}</pre>
  <p><strong>Response (Success):</strong></p>
  <pre>{
  "success": true,
  "short_code": "mylink",
  "short_url": "${origin}/mylink",
  "original_url": "https://example.com/very/long/url"
}</pre>
  <p><strong>cURL Example:</strong></p>
  <pre>curl -X POST ${origin}/api-short \\
  -H "X-API-Key: your-api-secret" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com", "custom_code": "test"}'</pre>
  
  <h2>2. Get Short URL Info</h2>
  <p><strong>Endpoint:</strong> <code>GET ${origin}/api-short?code=SHORTCODE</code></p>
  <p><strong>Headers:</strong></p>
  <pre>X-API-Key: your-api-secret</pre>
  <p><strong>Response (Success):</strong></p>
  <pre>{
  "id": "uuid-here",
  "short_code": "mylink",
  "original_url": "https://example.com/very/long/url",
  "created_at": "2024-01-01T00:00:00Z"
}</pre>
  <p><strong>cURL Example:</strong></p>
  <pre>curl ${origin}/api-short?code=mylink \\
  -H "X-API-Key: your-api-secret"</pre>
  
  <h2>3. Delete Short URL</h2>
  <p><strong>Endpoint:</strong> <code>DELETE ${origin}/api-short?code=SHORTCODE</code></p>
  <p><strong>Headers:</strong></p>
  <pre>X-API-Key: your-api-secret</pre>
  <p><strong>Response (Success):</strong></p>
  <pre>{
  "success": true,
  "message": "Short URL deleted"
}</pre>
  <p><strong>cURL Example:</strong></p>
  <pre>curl -X DELETE ${origin}/api-short?code=mylink \\
  -H "X-API-Key: your-api-secret"</pre>
  
  <hr>
  
  <h2>Error Responses</h2>
  <p>All error responses follow this format:</p>
  <pre>{
  "error": "Error message description"
}</pre>
  <p><strong>Common HTTP Status Codes:</strong></p>
  <ul>
    <li><code>400</code> - Bad Request (missing required fields, duplicate short code)</li>
    <li><code>401</code> - Unauthorized (invalid or missing API key)</li>
    <li><code>404</code> - Not Found (short URL doesn't exist)</li>
    <li><code>500</code> - Internal Server Error</li>
  </ul>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Main Worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route handling
    if (path === '/') {
      return handleIndex();
    }
    
    if (path === '/short') {
      return handleShortUI(request, env);
    }
    
    if (path === '/api-short') {
      return handleApiShort(request, env);
    }
    
    if (path === '/api-docs') {
      return handleApiDocs(request);
    }
    
    // Short code redirect (any other path)
    const shortCode = path.substring(1); // Remove leading slash
    
    if (shortCode) {
      return handleRedirect(request, env, shortCode);
    }
    
    return handle404();
  }
};
