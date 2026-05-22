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
const DONKI_PROXY_BASE_URL =
  'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/donki';

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

const parseAceEpamValue = value => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= -1.0e5) {
    return null;
  }
  return parsed;
};

const parseAceEpam = text => {
  const lines = text.split(/\r?\n/);
  return lines
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length >= 16)
    .map(parts => {
      const [year, month, day, time] = parts;
      const hours = time.padStart(4, '0').slice(0, 2);
      const minutes = time.padStart(4, '0').slice(2, 4);
      const timestamp = new Date(
        `${year}-${month}-${day}T${hours}:${minutes}:00Z`
      );

      return {
        timestamp,
        electronLow: parseAceEpamValue(parts[7]),
        electronHigh: parseAceEpamValue(parts[8]),
        protonLow: parseAceEpamValue(parts[10]),
        protonMid: parseAceEpamValue(parts[11]),
        protonHigh: parseAceEpamValue(parts[12]),
      };
    })
    .filter(entry => !Number.isNaN(entry.timestamp.valueOf()));
};

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

const formatRegionLabel = value => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith('1') && raw.length >= 5) {
    return raw.slice(1);
  }
  return raw;
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

const parseFlareEvents = text => {
  const events = [];
  const lines = text.split(/\r?\n/);
  const dateLine = lines.find(line => line.startsWith(':Date:'));
  const dateMatch = dateLine?.match(/:Date:\s*(\d{4})\s+(\d{2})\s+(\d{2})/);
  const fallbackDate = new Date();
  const fileDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : `${fallbackDate.getUTCFullYear()}-${String(fallbackDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
        fallbackDate.getUTCDate()
      ).padStart(2, '0')}`;

  lines.forEach(line => {
    if (!line.trim() || line.startsWith('#') || line.startsWith(':')) {
      return;
    }

    const parts = line.trim().split(/\s+/);
    // Remove the optional single-character qualifier (e.g. '+') after the event number
    if (parts.length > 1 && /^[+\-*?]$/.test(parts[1])) {
      parts.splice(1, 1);
    }
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

    const maxTime = parts[2];
    if (!maxTime || maxTime.length < 3 || maxTime.includes('/')) {
      return;
    }

    const hours = maxTime.padStart(4, '0').slice(0, 2);
    const minutes = maxTime.padStart(4, '0').slice(2, 4);
    const timestamp = new Date(`${fileDate}T${hours}:${minutes}:00Z`);
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

export async function fetchRecentFlares() {
  const now = new Date();
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10);
  let data;
  try {
    const res = await fetch(
      `${DONKI_PROXY_BASE_URL}/FLR?startDate=${fmt(start)}&endDate=${fmt(now)}`
    );
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map(flr => {
      const peakTime = flr.peakTime ?? flr.beginTime;
      const timestamp = peakTime ? new Date(peakTime.endsWith('Z') ? peakTime : peakTime + 'Z') : null;
      if (!timestamp || Number.isNaN(timestamp.valueOf())) return null;
      const regionNum = flr.activeRegionNum ? flr.activeRegionNum % 10000 : null;
      const obs = flr.instruments?.[0]?.displayName?.match(/GOES-\w+/)?.[0] ?? 'GOES';
      return {
        id: flr.flrID,
        class: flr.classType ?? '?',
        timestamp,
        observatory: obs,
        region: regionNum ? String(regionNum) : null,
        location: flr.sourceLocation ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchAceEpam() {
  const text = await fetchText(`${NOAA_PROXY_BASE_URL}/text/ace-epam.txt`);
  const entries = parseAceEpam(text);

  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  return entries
    .filter(entry => entry.timestamp.valueOf() >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);
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
  const deduped = new Map();

  results.forEach(region => {
    const id = String(region?.ar_noaanum ?? '').trim();
    const x = Number(region?.hpc_x);
    const y = Number(region?.hpc_y);

    if (!id || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    if (Math.abs(x) >= 1000 || Math.abs(y) >= 1000) {
      return;
    }

    deduped.set(id, {
      id,
      number: formatRegionLabel(id),
      x,
      y,
    });
  });

  return [...deduped.values()];
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
