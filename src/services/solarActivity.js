/**
 * NOAA Solar Activity API Service
 *
 * IMPORTANT: These API calls should be proxied through Cloudflare Workers
 * to handle CORS and provide caching.
 *
 * Setup Instructions:
 * 1. Deploy the Cloudflare Worker from /workers/api-proxy.js
 * 2. Update NOAA_PROXY_BASE_URL below to your Worker URL
 * 3. Configure routes in wrangler.toml
 */

const NOAA_PROXY_BASE_URL =
  'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/noaa';

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.text();
}

function parseFlareProbabilities(text) {
  const lines = text.split(/\r?\n/);
  let maxC = 0;
  let maxM = 0;
  let maxX = 0;
  let inSection = false;

  lines.forEach(line => {
    if (line.startsWith('#') && line.includes('Class C')) {
      inSection = true;
      return;
    }

    if (!inSection) {
      return;
    }

    if (!line.trim() || line.startsWith(':') || line.startsWith('#')) {
      return;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) {
      return;
    }

    const cValue = parseInt(parts[1], 10) || 0;
    const mValue = parseInt(parts[2], 10) || 0;
    const xValue = parseInt(parts[3], 10) || 0;

    maxC = Math.max(maxC, cValue);
    maxM = Math.max(maxM, mValue);
    maxX = Math.max(maxX, xValue);
  });

  return { c: maxC, m: maxM, x: maxX };
}

export async function fetchFlareProbabilities() {
  const text = await fetchText(
    `${NOAA_PROXY_BASE_URL}/text/3-day-solar-geomag-predictions.txt`
  );
  return parseFlareProbabilities(text);
}
