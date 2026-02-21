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

export async function fetchGoesMagnetometerData() {
  const [sources, primaryRaw, secondaryRaw] = await Promise.all([
    fetchJson(`${NOAA_PROXY_BASE_URL}/json/goes/instrument-sources.json`),
    fetchJson(`${NOAA_PROXY_BASE_URL}/json/goes/primary/magnetometers-3-day.json`),
    fetchJson(`${NOAA_PROXY_BASE_URL}/json/goes/secondary/magnetometers-3-day.json`),
  ]);

  // instrument-sources.json is an array; grab the first (and only) entry
  const sourceEntry = Array.isArray(sources) ? sources[0] : sources;
  const primarySat = sourceEntry?.magnetometers?.primary ?? '?';
  const secondarySat = sourceEntry?.magnetometers?.secondary ?? '?';
  const primaryLabel = `GOES-${primarySat}`;
  const secondaryLabel = `GOES-${secondarySat}`;

  // Index secondary entries by time_tag string for O(1) merging
  const secondaryMap = new Map();
  for (const entry of secondaryRaw) {
    secondaryMap.set(entry.time_tag, entry);
  }

  // Build unified data array anchored on primary timestamps.
  // null values cause Recharts to render a line break (connectNulls defaults false)
  // which visually matches the SWPC chart behaviour during arcjet-firing periods.
  const data = primaryRaw
    .map(entry => {
      const sec = secondaryMap.get(entry.time_tag);
      return {
        timestamp: new Date(entry.time_tag),
        hpPrimary: entry.arcjet_flag ? null : (entry.Hp ?? null),
        hpSecondary: sec
          ? sec.arcjet_flag
            ? null
            : (sec.Hp ?? null)
          : null,
      };
    })
    .filter(entry => !Number.isNaN(entry.timestamp.valueOf()));

  return { data, primaryLabel, secondaryLabel };
}
