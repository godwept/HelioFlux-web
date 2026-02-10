const WORKER_BASE_URL =
  'https://helioflux-api-proxy.mathew-stewart.workers.dev/api';

export async function fetchNews() {
  const response = await fetch(`${WORKER_BASE_URL}/news`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const xml = await response.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');

  const articles = [];
  items.forEach(item => {
    const title = item.querySelector('title')?.textContent ?? '';
    const link = item.querySelector('link')?.textContent ?? '';
    const pubDate = item.querySelector('pubDate')?.textContent ?? '';
    const sourceEl = item.querySelector('source');
    const source = sourceEl?.textContent ?? '';
    const sourceUrl = sourceEl?.getAttribute('url') ?? '';

    if (title && link) {
      articles.push({
        title: title.replace(/\s*-\s*[^-]+$/, ''),
        link,
        pubDate: pubDate ? new Date(pubDate) : null,
        source,
        sourceUrl,
      });
    }
  });

  articles.sort((a, b) => {
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate - a.pubDate;
  });

  return articles.slice(0, 10);
}
