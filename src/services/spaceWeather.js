/**
 * NOAA Space Weather API Service
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

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function parseMagneticFieldData(rows) {
  return rows
    .slice(1)
    .map(row => ({
      timestamp: new Date(row[0]),
      bx: parseFloat(row[1]) || 0,
      by: parseFloat(row[2]) || 0,
      bz: parseFloat(row[3]) || 0,
      bt: parseFloat(row[6]) || 0,
    }))
    .filter(entry => !Number.isNaN(entry.timestamp.valueOf()));
}

function parsePlasmaData(rows) {
  return rows
    .slice(1)
    .map(row => ({
      timestamp: new Date(row[0]),
      density: parseFloat(row[1]) || 0,
      speed: parseFloat(row[2]) || 0,
      temperature: parseFloat(row[3]) || 0,
    }))
    .filter(
      entry =>
        !Number.isNaN(entry.timestamp.valueOf()) &&
        !(entry.speed === 0 && entry.density === 0)
    );
}

function parseKpIndex(rows) {
  return rows
    .slice(1)
    .map(row => ({
      timestamp: new Date(row[0].replace(' ', 'T') + 'Z'),
      kp: parseFloat(row[1]) || 0,
    }))
    .filter(entry => !Number.isNaN(entry.timestamp.valueOf()));
}

export async function fetchMagneticFieldData() {
  const data = await fetchJson(
    `${NOAA_PROXY_BASE_URL}/products/solar-wind/mag-3-day.json`
  );
  return parseMagneticFieldData(data);
}

export async function fetchPlasmaData() {
  const data = await fetchJson(
    `${NOAA_PROXY_BASE_URL}/products/solar-wind/plasma-3-day.json`
  );
  return parsePlasmaData(data);
}

export async function fetchKpIndex() {
  const data = await fetchJson(
    `${NOAA_PROXY_BASE_URL}/products/noaa-planetary-k-index.json`
  );
  return parseKpIndex(data);
}

export async function fetchProtonFlux() {
  const data = await fetchJson(
    `${NOAA_PROXY_BASE_URL}/json/goes/primary/integral-protons-3-day.json`
  );
  return data
    .filter(entry => entry.energy === '>=10 MeV' && entry.time_tag)
    .map(entry => ({
      timestamp: new Date(entry.time_tag),
      flux: parseFloat(entry.flux) || 0,
    }))
    .filter(entry => !Number.isNaN(entry.timestamp.valueOf()))
    .sort((a, b) => a.timestamp - b.timestamp);
}
