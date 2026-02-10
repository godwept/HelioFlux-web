/**
 * Cloudflare Worker - API Proxy for HelioFlux
 * 
 * This Worker handles CORS and proxies requests to various space weather APIs.
 * It provides a unified API endpoint for the frontend to consume.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * ========================
 * 
 * 1. Install Wrangler CLI:
 *    npm install -g wrangler
 * 
 * 2. Login to Cloudflare:
 *    wrangler login
 * 
 * 3. Create wrangler.toml in the project root:
 *    
 *    name = "helioflux-api-proxy"
 *    main = "workers/api-proxy.js"
 *    compatibility_date = "2024-01-01"
 *    
 *    [env.production]
 *    routes = [
 *      { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
 *    ]
 * 
 * 4. Deploy the Worker:
 *    wrangler deploy
 * 
 * 5. Update src/services/helioviewer.js:
 *    Change PROXY_BASE_URL to your Worker URL or '/api/helioviewer' if using routes
 * 
 * TESTING:
 * ========
 * 
 * Local development:
 *   wrangler dev
 * 
 * Test endpoints:
 *   curl http://localhost:8787/api/helioviewer/getClosestImage/?date=2024-02-09T14:30:00Z&sourceId=13
 *   (Replace the date with current UTC date/time for real data)
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for all routes
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let targetUrl;

      // Helioviewer API proxy
      if (path.startsWith('/api/helioviewer')) {
        targetUrl = 'https://api.helioviewer.org/v2' + 
          path.replace('/api/helioviewer', '') + url.search;
      }
      // NOAA SWPC JSON endpoints
      else if (path.startsWith('/api/noaa/')) {
        targetUrl = 'https://services.swpc.noaa.gov' + 
          path.replace('/api/noaa', '') + url.search;
      }
      // NOAA flare events text files
      else if (path.startsWith('/api/flare-events/')) {
        const date = path.split('/').pop().replace('.txt', '');
        // Try HTTPS first, fallback handled by error catching
        targetUrl = `https://services.swpc.noaa.gov/text/${date}events.txt`;
      }
      // LASCO coronagraph images
      else if (path.startsWith('/api/lasco/')) {
        const lascoPath = path.replace('/api/lasco/', '');
        targetUrl = `https://soho.nascom.nasa.gov/data/${lascoPath}`;
      }
      // HMI Magnetogram
      else if (path.startsWith('/api/hmi/')) {
        targetUrl = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIB.jpg';
      }
      // ENLIL solar wind model
      else if (path.startsWith('/api/enlil/')) {
        targetUrl = 'https://services.swpc.noaa.gov/images/animations/enlil/';
      }
      // HEK active region data
      else if (path.startsWith('/api/hek/')) {
        targetUrl = 'https://www.lmsal.com/hek/her' + url.search;
      }
      else {
        return new Response('Not found', { 
          status: 404,
          headers: corsHeaders 
        });
      }

      // Fetch from target API
      const apiResponse = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      // Clone response and add CORS headers
      const response = new Response(apiResponse.body, apiResponse);
      
      // Add CORS headers to response
      Object.keys(corsHeaders).forEach(key => {
        response.headers.set(key, corsHeaders[key]);
      });

      // Add caching headers based on content type
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('image')) {
        // Cache images for 15 minutes
        response.headers.set('Cache-Control', 'public, max-age=900');
      } else if (contentType.includes('json')) {
        // Cache JSON data for 60 seconds
        response.headers.set('Cache-Control', 'public, max-age=60');
      } else {
        // Cache other content for 5 minutes
        response.headers.set('Cache-Control', 'public, max-age=300');
      }

      return response;

    } catch (error) {
      console.error('Proxy error:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Proxy error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
