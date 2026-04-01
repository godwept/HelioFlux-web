/**
 * Helioviewer API Service
 * 
 * IMPORTANT: These API calls should be proxied through Cloudflare Workers
 * to handle CORS and provide caching. 
 * 
 * Setup Instructions:
 * 1. Deploy the Cloudflare Worker from /workers/api-proxy.js
 * 2. Update PROXY_BASE_URL below to your Worker URL
 * 3. Configure routes in wrangler.toml
 */

// TODO: Replace with your Cloudflare Worker URL after deployment
// Example: https://api.your-worker.workers.dev
const PROXY_BASE_URL = 'https://helioflux-api-proxy.mathew-stewart.workers.dev/api/helioviewer';

// AIA 304Å Source ID (chromosphere view)
const AIA_304_SOURCE_ID = 13;

// Image dimensions optimized for mobile
const IMAGE_WIDTH = 512;

/**
 * Get the closest image ID for a specific date and source
 * @param {Date} date - The date to fetch the image for
 * @param {number} sourceId - The source ID (default: AIA 304)
 * @returns {Promise<Object>} Image metadata with id, date, and name
 */
export async function getClosestImage(date, sourceId = AIA_304_SOURCE_ID) {
  const isoDate = date.toISOString();
  const url = `${PROXY_BASE_URL}/getClosestImage/?date=${isoDate}&sourceId=${sourceId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching closest image:', error);
    throw error;
  }
}

/**
 * Get the download URL for an image by its ID
 * @param {string|number} imageId - The image ID from getClosestImage
 * @param {number} width - Image width in pixels
 * @returns {string} The full URL to download the image
 */
export function getImageUrl(imageId, width = IMAGE_WIDTH) {
  return `${PROXY_BASE_URL}/downloadImage/?id=${imageId}&width=${width}&type=png`;
}

/**
 * Fetch 60 frames of AIA 304 imagery over 15 hours (15 min intervals).
 * Throws if SDO data is stale (> 6 hours old) or if only a single unique
 * image is available (instrument offline).
 * @returns {Promise<Array<string>>} Array of image URLs
 */
export async function fetchSolarFrames() {
  const now = new Date();
  const frameCount = 60;
  const intervalMinutes = 15;
  const totalMinutes = (frameCount - 1) * intervalMinutes;

  // Probe the most recent available image first.
  const latestData = await getClosestImage(now);
  const latestImageDate = new Date(latestData.date.replace(' ', 'T') + 'Z');
  const ageMs = now - latestImageDate;
  const sixHoursMs = 6 * 60 * 60 * 1000;

  if (ageMs > sixHoursMs) {
    const ageHours = Math.round(ageMs / (60 * 60 * 1000));
    throw new Error(
      `SDO imagery is currently unavailable — last image received ${ageHours}h ago`
    );
  }

  try {
    const promises = [];
    for (let i = 0; i < frameCount; i++) {
      const frameTime = new Date(
        now.getTime() - (totalMinutes - i * intervalMinutes) * 60000
      );
      promises.push(
        getClosestImage(frameTime).then(imageData => ({
          index: i,
          url: getImageUrl(imageData.id),
          date: imageData.date,
          id: imageData.id,
        }))
      );
    }

    const results = await Promise.all(promises);
    results.sort((a, b) => a.index - b.index);

    // Deduplicate by image ID to handle any partial gaps in the data stream.
    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return unique.map(r => r.url);
  } catch (error) {
    console.error('Error fetching solar frames:', error);
    throw error;
  }
}
