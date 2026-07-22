import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMagneticFieldData, fetchPlasmaData } from './spaceWeather.js';

test('fetches space weather data through the deployed API proxy', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;

  globalThis.fetch = async url => {
    requestedUrl = url;
    return new Response(JSON.stringify([
      { time_tag: '2026-07-22T00:00:00', bx_gsm: 1, by_gsm: 2, bz_gsm: -3, bt: 6 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const data = await fetchMagneticFieldData();

    assert.equal(
      requestedUrl,
      'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/noaa/json/rtsw/rtsw_mag_1m.json'
    );
    assert.equal(data[0].bt, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetches plasma data from the replacement NOAA RTSW feed', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;

  globalThis.fetch = async url => {
    requestedUrl = url;
    return new Response(JSON.stringify([
      {
        time_tag: '2026-07-22T00:00:00',
        proton_density: 7,
        proton_speed: 420,
        proton_temperature: 50000,
      },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const data = await fetchPlasmaData();

    assert.equal(
      requestedUrl,
      'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/noaa/json/rtsw/rtsw_wind_1m.json'
    );
    assert.equal(data[0].speed, 420);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
