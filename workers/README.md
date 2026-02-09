# Cloudflare Workers Setup for HelioFlux

This directory contains the Cloudflare Worker that proxies API requests from the HelioFlux web application.

## Why a Proxy?

The proxy is required for:
1. **CORS handling** - Many space weather APIs don't support CORS
2. **Caching** - Reduce API load and improve performance
3. **Rate limiting** - Protect against abuse (can be added)
4. **FTP to HTTP conversion** - Some NOAA data is only available via FTP

## Setup Instructions

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create wrangler.toml

Create a `wrangler.toml` file in the project root:

```toml
name = "helioflux-api-proxy"
main = "workers/api-proxy.js"
compatibility_date = "2024-01-01"

# For custom domain routing (after deploying to Cloudflare Pages)
[env.production]
routes = [
  { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
]
```

### 4. Deploy the Worker

```bash
wrangler deploy
```

This will output a URL like: `https://helioflux-api-proxy.your-account.workers.dev`

### 5. Update Frontend Configuration

After deploying, update the `PROXY_BASE_URL` in:
- `src/services/helioviewer.js`

Change from:
```javascript
const PROXY_BASE_URL = '/api/helioviewer';
```

To:
```javascript
const PROXY_BASE_URL = 'https://helioflux-api-proxy.your-account.workers.dev/api/helioviewer';
```

Or, if using custom domain routing with Cloudflare Pages, you can keep it as `/api/helioviewer`.

## Local Development

To test the Worker locally:

```bash
wrangler dev
```

This starts a local server at `http://localhost:8787`

## Testing Endpoints

After deployment, test the proxy:

```bash
# Test Helioviewer API
curl "https://your-worker.workers.dev/api/helioviewer/getClosestImage/?date=2026-02-09T14:30:00Z&sourceId=13"

# Test NOAA API
curl "https://your-worker.workers.dev/api/noaa/products/solar-wind/mag-3-day.json"
```

## Supported Routes

- `/api/helioviewer/*` - Helioviewer API for solar imagery
- `/api/noaa/*` - NOAA SWPC APIs for space weather data
- `/api/flare-events/{date}.txt` - Solar flare event reports
- `/api/lasco/*` - LASCO coronagraph images
- `/api/hmi/*` - HMI magnetogram images
- `/api/enlil/*` - ENLIL solar wind model

## Caching Strategy

The Worker implements intelligent caching:
- **Images**: 15 minutes (900s)
- **JSON data**: 60 seconds
- **Other content**: 5 minutes (300s)

## Next Steps

1. Consider adding rate limiting using Cloudflare Workers KV
2. Add authentication if needed for sensitive endpoints
3. Monitor usage via Cloudflare dashboard
4. Set up alerts for errors or high usage

## Documentation

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [AI_REF.txt](../AI_REF.txt) - Full API documentation
