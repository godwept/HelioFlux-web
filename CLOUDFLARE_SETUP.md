# Cloudflare Workers Setup Guide

This document provides step-by-step instructions for deploying the HelioFlux API proxy using Cloudflare Workers.

## Overview

The HelioFlux application requires a Cloudflare Worker to:
- Proxy API requests to avoid CORS issues
- Cache responses for better performance
- Convert FTP endpoints to HTTP where needed

## Prerequisites

- A Cloudflare account (free tier works fine)
- Node.js and npm installed locally
- Wrangler CLI (Cloudflare's developer tool)

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### 3. Create Configuration File

Create a `wrangler.toml` file in the project root:

```toml
name = "helioflux-api-proxy"
main = "workers/api-proxy.js"
compatibility_date = "2024-01-01"

# Optional: Custom domain routing
# [env.production]
# routes = [
#   { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
# ]
```

### 4. Deploy the Worker

```bash
wrangler deploy
```

After deployment, you'll get a URL like:
```
https://helioflux-api-proxy.your-account.workers.dev
```

### 5. Update Frontend Configuration

Edit `src/services/helioviewer.js` and update the `PROXY_BASE_URL`:

```javascript
// Before (local development placeholder)
const PROXY_BASE_URL = '/api/helioviewer';

// After (with deployed Worker)
const PROXY_BASE_URL = 'https://helioflux-api-proxy.your-account.workers.dev/api/helioviewer';
```

## Local Development

To test the Worker locally before deploying:

```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`

You can then update your frontend to use this URL during development:

```javascript
const PROXY_BASE_URL = 'http://localhost:8787/api/helioviewer';
```

## Testing the Deployment

After deploying, test the endpoints:

```bash
# Test Helioviewer API (replace date with current UTC date/time)
curl "https://your-worker.workers.dev/api/helioviewer/getClosestImage/?date=2024-02-09T14:30:00Z&sourceId=13"

# Test NOAA API
curl "https://your-worker.workers.dev/api/noaa/products/solar-wind/mag-3-day.json"
```

## Using with Cloudflare Pages

If you deploy the frontend to Cloudflare Pages, you can use custom routing to avoid hardcoding the Worker URL:

1. Add routes to `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
]
```

2. Keep the frontend configuration as a relative path:

```javascript
const PROXY_BASE_URL = '/api/helioviewer';
```

3. The requests will automatically route through your Worker

## Supported API Endpoints

The Worker proxies the following endpoints:

### Helioviewer API
- `/api/helioviewer/getClosestImage/` - Get closest solar image by date
- `/api/helioviewer/downloadImage/` - Download image by ID

### NOAA SWPC
- `/api/noaa/products/solar-wind/mag-3-day.json` - Magnetic field data
- `/api/noaa/products/solar-wind/plasma-3-day.json` - Plasma data
- `/api/noaa/products/noaa-planetary-k-index.json` - Kp index
- `/api/noaa/json/goes/primary/xrays-3-day.json` - X-ray flux

### Other Endpoints
- `/api/flare-events/{date}.txt` - Solar flare events
- `/api/lasco/*` - LASCO coronagraph images
- `/api/hmi/*` - HMI magnetogram images
- `/api/enlil/*` - ENLIL solar wind model

## Caching Strategy

The Worker implements intelligent caching based on content type:

| Content Type | Cache Duration |
|--------------|----------------|
| Images       | 15 minutes     |
| JSON data    | 60 seconds     |
| Other        | 5 minutes      |

## Monitoring

View Worker metrics in the Cloudflare dashboard:

1. Go to https://dash.cloudflare.com
2. Select "Workers & Pages"
3. Click on your Worker
4. View requests, errors, and CPU time

## Troubleshooting

### CORS Errors

The Worker adds CORS headers to all responses. If you still see CORS errors:
- Check that the Worker is deployed
- Verify the Worker URL is correct in your frontend
- Check browser console for specific error messages

### 404 Errors

If requests return 404:
- Verify the endpoint path in the Worker code
- Check that the upstream API is accessible
- Test the upstream API directly

### Timeout Errors

Cloudflare Workers have a 50ms CPU time limit on free tier:
- Large responses may timeout
- Consider implementing pagination
- Use Worker KV for caching if needed

## Advanced Configuration

### Rate Limiting

To add rate limiting, you can use Cloudflare Workers KV:

```javascript
// Add to worker
const RATE_LIMIT = 100; // requests per minute
// Implementation left as exercise
```

### Authentication

To add API key authentication:

```javascript
// Add to worker
const API_KEY = env.API_KEY;
if (request.headers.get('X-API-Key') !== API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Custom Domains

To use a custom domain:
1. Add your domain to Cloudflare
2. Update `wrangler.toml` with routes
3. Deploy with `wrangler deploy --env production`

## Cost Considerations

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

For most development and small-scale use, the free tier is sufficient.

Paid tiers start at $5/month for 10 million requests.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Full API Documentation](../AI_REF.txt)

## Support

For issues with:
- Cloudflare Workers: [Cloudflare Discord](https://discord.gg/cloudflaredev)
- HelioFlux Application: Create an issue on GitHub
- Space Weather APIs: Check respective API documentation
