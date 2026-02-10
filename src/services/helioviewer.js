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
const IMAGE_WIDTH = 1024;

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
  return `${PROXY_BASE_URL}/downloadImage/?id=${imageId}&width=${width}&type=jpg`;
}

/**
 * Fetch 30 frames of AIA 304 imagery over 7.5 hours (15 min intervals)
 * @returns {Promise<Array<string>>} Array of image URLs
 */
export async function fetchSolarFrames() {
  const now = new Date();
  const frameCount = 60;
  const intervalMinutes = 15; // 15 minutes between frames
  
  // Calculate time range: 7.5 hours ago to now
  const totalMinutes = (frameCount - 1) * intervalMinutes;
  
  try {
    // Fetch all frames concurrently
    const promises = [];
    for (let i = 0; i < frameCount; i++) {
      const frameTime = new Date(now.getTime() - (totalMinutes - i * intervalMinutes) * 60000);
      promises.push(
        getClosestImage(frameTime).then(imageData => ({
          index: i,
          url: getImageUrl(imageData.id),
          date: imageData.date,
        }))
      );
    }
    
    const results = await Promise.all(promises);
    
    // Sort by index to ensure correct order (oldest to newest)
    results.sort((a, b) => a.index - b.index);
    
    return results.map(r => r.url);
  } catch (error) {
    console.error('Error fetching solar frames:', error);
    throw error;
  }
}
