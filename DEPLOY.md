# Cloudflare Deployment Guide

This guide will help you deploy the HelioFlux Worker to Cloudflare.

## Prerequisites

- A Cloudflare account (free tier works)
- Node.js and npm installed

## Quick Deploy

### 1. Install Dependencies

```bash
npm install
```

This installs all dependencies including Wrangler (Cloudflare's CLI).

### 2. Login to Cloudflare

```bash
npm run worker:deploy
```

On first run, this will prompt you to login. Follow the browser authentication flow.

### 3. Deploy the Worker

After authentication, the deploy command will:
- Build your worker
- Upload it to Cloudflare
- Provide you with a worker URL like: `https://helioflux-api-proxy.your-account.workers.dev`

### 4. Configure Your Account ID (Optional but Recommended)

1. Get your account ID from: https://dash.cloudflare.com/
2. Open `wrangler.toml`
3. Uncomment and set the `account_id` field

## Available Commands

### Development

Start a local development server:

```bash
npm run worker:dev
```

This runs the worker locally at `http://localhost:8787`

### Deploy

Deploy to Cloudflare:

```bash
npm run worker:deploy
```

### Monitor

Watch real-time logs from your deployed worker:

```bash
npm run worker:tail
```

## Testing Your Deployment

After deployment, test your worker endpoints:

```bash
# Replace YOUR_WORKER_URL with your actual worker URL
curl "YOUR_WORKER_URL/api/noaa/products/noaa-planetary-k-index.json"
```

## Using with the Frontend

After deploying the worker, you need to update your frontend to use the worker URL.

Edit `src/services/helioviewer.js` (or relevant service files):

```javascript
// Replace this placeholder URL
const PROXY_BASE_URL = '/api/helioviewer';

// With your actual worker URL
const PROXY_BASE_URL = 'https://helioflux-api-proxy.your-account.workers.dev/api/helioviewer';
```

## Cloudflare Pages Integration

If you're deploying the frontend to Cloudflare Pages, you can use custom routing to avoid hardcoding URLs:

1. Edit `wrangler.toml` and uncomment the production environment section:

```toml
[env.production]
routes = [
  { pattern = "your-domain.com/api/*", zone_name = "your-domain.com" }
]
```

2. Deploy with the production environment:

```bash
npx wrangler deploy --env production
```

3. Keep the frontend using relative paths:

```javascript
const PROXY_BASE_URL = '/api/helioviewer';
```

## Configuration Details

### wrangler.toml

The main configuration file includes:

- `name`: Worker name (helioflux-api-proxy)
- `main`: Entry point (workers/api-proxy.js)
- `compatibility_date`: API compatibility date
- `account_id`: Your Cloudflare account ID (optional)
- `routes`: Custom domain routing (optional)

### Supported Endpoints

The worker proxies these API endpoints:

- `/api/helioviewer/*` - Helioviewer API for solar imagery
- `/api/noaa/*` - NOAA SWPC space weather data
- `/api/flare-events/{date}.txt` - Solar flare events
- `/api/lasco/*` - LASCO coronagraph images
- `/api/hmi/*` - HMI magnetogram images
- `/api/enlil/*` - ENLIL solar wind model

## Troubleshooting

### Authentication Issues

If you see authentication errors:

```bash
npx wrangler login
```

Then try deploying again.

### Configuration Errors

Ensure your `wrangler.toml` file:
- Has no BOM (Byte Order Mark) character
- Uses valid TOML syntax
- Points to existing files

### Worker Not Found (404)

Check that:
- The worker deployed successfully
- The URL is correct
- The endpoint path matches supported routes

### CORS Errors

The worker includes CORS headers, but if you still see errors:
- Verify the worker is running
- Check browser console for specific messages
- Test the worker endpoint directly with curl

## Cost Considerations

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

For most development and small-scale usage, the free tier is sufficient.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Support

For issues:
- Check the [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for detailed setup
- Review [workers/README.md](workers/README.md) for worker-specific info
- Create an issue on GitHub for bugs or feature requests
