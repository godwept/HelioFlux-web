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
const WORKER_BASE_URL =
  'https://helioflux-api-proxy.mathew-stewart.workers.dev/api';

export const MAGNETOGRAM_URL = `${WORKER_BASE_URL}/hmi/`;
export const LASCO_C2_GIF_URL =
  `${WORKER_BASE_URL}/lasco/LATEST/current_c2.gif`;
export const LASCO_C3_GIF_URL =
  `${WORKER_BASE_URL}/lasco/LATEST/current_c3.gif`;
const HEK_BASE_URL = `${WORKER_BASE_URL}/hek`;

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.text();
}

async function fetchTextOptional(url) {
  const response = await fetch(url);
  if (response.status === 204 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

const parseTimestamp = value => {
  if (!value) {
    return null;
  }
  const normalized = value.replace('_', 'T');
  const year = normalized.slice(0, 4);
  const month = normalized.slice(4, 6);
  const day = normalized.slice(6, 8);
  const time = normalized.slice(9, 15);
  if (!year || !month || !day || !time) {
    return null;
  }
  const hour = time.slice(0, 2);
  const minute = time.slice(2, 4);
  const second = time.slice(4, 6);
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
};

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

const parseXraySeries = entries => {
  const byTimestamp = new Map();
  const normalizeFlux = value => {
    const flux = Number.parseFloat(value);
    return Number.isFinite(flux) && flux > 0 ? flux : null;
  };

  entries.forEach(entry => {
    if (!entry?.time_tag) {
      return;
    }
    const timestamp = new Date(entry.time_tag);
    if (Number.isNaN(timestamp.valueOf())) {
      return;
    }
    const key = timestamp.toISOString();
    if (!byTimestamp.has(key)) {
      byTimestamp.set(key, {
        timestamp,
        goes18Short: null,
        goes18Long: null,
        goes19Short: null,
        goes19Long: null,
      });
    }

    const item = byTimestamp.get(key);
    const energy = entry.energy;
    const flux = normalizeFlux(entry.flux);
    if (entry.satellite === 18) {
      if (energy === '0.05-0.4nm') {
        item.goes18Short = flux;
      } else if (energy === '0.1-0.8nm') {
        item.goes18Long = flux;
      }
    }

    if (entry.satellite === 19) {
      if (energy === '0.05-0.4nm') {
        item.goes19Short = flux;
      } else if (energy === '0.1-0.8nm') {
        item.goes19Long = flux;
      }
    }
  });

  return [...byTimestamp.values()].sort(
    (a, b) => a.timestamp - b.timestamp
  );
};

export async function fetchXrayFlux() {
  const [primary, secondary] = await Promise.all([
    fetchJson(`${NOAA_PROXY_BASE_URL}/json/goes/primary/xrays-3-day.json`),
    fetchJson(`${NOAA_PROXY_BASE_URL}/json/goes/secondary/xrays-3-day.json`),
  ]);

  const combined = [...primary, ...secondary];
  const parsed = parseXraySeries(combined);
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  return parsed.filter(entry => entry.timestamp.valueOf() >= cutoff);
}

const parseFlareEvents = (text, fileDate) => {
  const events = [];
  const lines = text.split(/\r?\n/);

  lines.forEach(line => {
    if (!line.trim() || line.startsWith('#')) {
      return;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) {
      return;
    }

    const eventType = parts[6];
    if (eventType !== 'XRA') {
      return;
    }

    const flareClass = parts[8];
    if (!flareClass || !/^[A-Z]/.test(flareClass)) {
      return;
    }

    const classLetter = flareClass[0];
    const classValue = parseFloat(flareClass.slice(1)) || 0;
    if (classLetter === 'M' && classValue < 1) {
      return;
    }
    if (classLetter !== 'M' && classLetter !== 'X') {
      return;
    }

    const maxTime = parts[2];
    if (!maxTime || maxTime.length < 3) {
      return;
    }

    const hours = maxTime.padStart(4, '0').slice(0, 2);
    const minutes = maxTime.padStart(4, '0').slice(2, 4);
    const timestamp = new Date(
      `${fileDate}T${hours}:${minutes}:00Z`
    );
    if (Number.isNaN(timestamp.valueOf())) {
      return;
    }

    events.push({
      id: parts[0],
      class: flareClass,
      timestamp,
      observatory: parts[4],
      region: parts[10] ?? null,
    });
  });

  return events;
};

const formatEventDate = date =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
    date.getUTCDate()
  ).padStart(2, '0')}`;

export async function fetchRecentFlares() {
  const now = new Date();
  const days = [0, 1, 2].map(offset => {
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    return formatEventDate(date);
  });

  const results = await Promise.all(
    days.map(async dateKey => {
      const text = await fetchTextOptional(
        `${WORKER_BASE_URL}/flare-events/${dateKey}events.txt`
      );
      if (!text) {
        return [];
      }
      const fileDate = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
      return parseFlareEvents(text, fileDate);
    })
  );

  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  return results
    .flat()
    .filter(event => event.timestamp.valueOf() >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchActiveRegions(startTime, endTime) {
  const params = new URLSearchParams({
    cosec: '2',
    cmd: 'search',
    type: 'column',
    event_type: 'ar',
    event_coordsys: 'helioprojective',
    event_starttime: startTime.toISOString().slice(0, 19),
    event_endtime: endTime.toISOString().slice(0, 19),
    x1: '-1200',
    x2: '1200',
    y1: '-1200',
    y2: '1200',
  });

  const data = await fetchJson(`${HEK_BASE_URL}?${params.toString()}`);
  const results = Array.isArray(data?.result) ? data.result : [];
  return results
    .map(region => ({
      id: region.ar_noaanum,
      number: region.ar_noaanum,
      x: Number(region.hpc_x),
      y: Number(region.hpc_y),
    }))
    .filter(
      region =>
        Number.isFinite(region.x) &&
        Number.isFinite(region.y) &&
        Math.abs(region.x) < 1000 &&
        Math.abs(region.y) < 1000
    );
}

export async function fetchLastModified(url) {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    return null;
  }
  const value = response.headers.get('last-modified');
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export async function fetchEnlilFrames() {
  const listing = await fetchText(`${WORKER_BASE_URL}/enlil/`);

  const matches = [...listing.matchAll(/href="([^"]+?\.(?:jpg|png))"/gi)];
  const files = matches.map(match => match[1]);
  const framesByRun = new Map();

  files.forEach(file => {
    const runMatch = file.match(/enlil_com2_(\d+)_/);
    const timestampMatch = file.match(/(\d{8}[T_]?\d{6})/);
    if (!runMatch || !timestampMatch) {
      return;
    }
    const runKey = runMatch[1];
    if (!framesByRun.has(runKey)) {
      framesByRun.set(runKey, []);
    }
    framesByRun.get(runKey).push({
      file,
      timestamp: parseTimestamp(timestampMatch[1]),
    });
  });

  if (!framesByRun.size) {
    return { frames: [], timestamp: null };
  }

  const latestRun = [...framesByRun.entries()].reduce((latest, entry) => {
    const latestFrame = entry[1].reduce(
      (max, frame) => (frame.timestamp > max ? frame.timestamp : max),
      new Date(0)
    );
    if (!latest || latestFrame > latest.latestFrame) {
      return { runKey: entry[0], latestFrame, frames: entry[1] };
    }
    return latest;
  }, null);

  if (!latestRun) {
    return { frames: [], timestamp: null };
  }

  const sortedFrames = latestRun.frames
    .filter(frame => frame.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp);
  const downsampleStep = Math.max(1, Math.ceil(sortedFrames.length / 48));
  const downsampled = sortedFrames.filter((_, index) => index % downsampleStep === 0);

  return {
    frames: downsampled.map(frame => `${WORKER_BASE_URL}/enlil/${frame.file}`),
    timestamp: latestRun.latestFrame,
  };
}
