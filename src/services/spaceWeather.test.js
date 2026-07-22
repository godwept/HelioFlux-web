import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMagneticFieldData } from './spaceWeather.js';

test('fetches space weather data through the deployed API proxy', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;

  globalThis.fetch = async url => {
    requestedUrl = url;
    return new Response(JSON.stringify([
      ['time_tag', 'bx_gsm', 'by_gsm', 'bz_gsm', 'lon_gsm', 'lat_gsm', 'bt'],
      ['2026-07-22T00:00:00Z', '1', '2', '-3', '4', '5', '6'],
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const data = await fetchMagneticFieldData();

    assert.equal(
      requestedUrl,
      'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/noaa/products/solar-wind/mag-3-day.json'
    );
    assert.equal(data[0].bt, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
