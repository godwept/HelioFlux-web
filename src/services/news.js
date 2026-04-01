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
  const getImageFromDescription = description => {
    if (!description) return '';
    try {
      const htmlDoc = new DOMParser().parseFromString(description, 'text/html');
      return htmlDoc.querySelector('img')?.getAttribute('src') ?? '';
    } catch {
      return '';
    }
  };
  items.forEach(item => {
    const title = item.querySelector('title')?.textContent ?? '';
    const link = item.querySelector('link')?.textContent ?? '';
    const pubDate = item.querySelector('pubDate')?.textContent ?? '';
    const sourceEl = item.querySelector('source');
    const source = sourceEl?.textContent ?? '';
    const sourceUrl = sourceEl?.getAttribute('url') ?? '';
    const description = item.querySelector('description')?.textContent ?? '';
    const mediaContent = item.getElementsByTagName('media:content')[0];
    const mediaThumb = item.getElementsByTagName('media:thumbnail')[0];
    const enclosure = item.getElementsByTagName('enclosure')[0];
    const imageUrl =
      mediaContent?.getAttribute('url') ??
      mediaThumb?.getAttribute('url') ??
      enclosure?.getAttribute('url') ??
      getImageFromDescription(description);

    if (title && link) {
      articles.push({
        title: title.replace(/\s*-\s*[^-]+$/, ''),
        link,
        pubDate: pubDate ? new Date(pubDate) : null,
        source,
        sourceUrl,
        imageUrl,
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

// ---------------------------------------------------------------------------
// NOAA Forecast Discussion
// ---------------------------------------------------------------------------

function normalizeDiscussionText(raw) {
  return raw
    .replace(/\r/g, '')
    .replace(/([^\n])\n([^\n])/g, '$1 $2') // rejoin soft-wrapped lines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +/g, ' ')
    .trim();
}

function parseForecastDiscussion(text) {
  const issuedMatch = text.match(/:Issued:\s*(.+)/);
  const issueTime = issuedMatch ? issuedMatch[1].trim() : null;

  // Strip comment and metadata lines
  const cleaned = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#') && !line.startsWith(':'))
    .join('\n');

  const sectionDefs = [
    { key: 'solar', title: 'Solar Activity' },
    { key: 'particle', title: 'Energetic Particle' },
    { key: 'wind', title: 'Solar Wind' },
    { key: 'geospace', title: 'Geospace' },
  ];

  const results = [];
  for (let i = 0; i < sectionDefs.length; i++) {
    const { key, title } = sectionDefs[i];
    const nextTitle = i + 1 < sectionDefs.length ? sectionDefs[i + 1].title : null;

    const startIdx = cleaned.indexOf(title);
    if (startIdx === -1) continue;

    const endIdx = nextTitle
      ? cleaned.indexOf(nextTitle, startIdx + title.length)
      : cleaned.length;
    const body = cleaned.slice(startIdx + title.length, endIdx !== -1 ? endIdx : cleaned.length);

    const summaryMatch = body.match(/\.24 hr Summary\.\.\.\s*([\s\S]*?)(?=\.Forecast\.\.\.|$)/);
    const forecastMatch = body.match(/\.Forecast\.\.\.\s*([\s\S]*?)$/);

    results.push({
      key,
      title,
      summary: summaryMatch ? normalizeDiscussionText(summaryMatch[1]) : '',
      forecast: forecastMatch ? normalizeDiscussionText(forecastMatch[1]) : '',
      issueTime,
    });
  }

  return results;
}

export async function fetchForecastDiscussion() {
  const response = await fetch(`${WORKER_BASE_URL}/noaa/text/discussion.txt`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const text = await response.text();
  return parseForecastDiscussion(text);
}
