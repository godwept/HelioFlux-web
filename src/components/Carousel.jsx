import { useEffect, useState } from 'react';
import { fetchKpIndex, fetchMagneticFieldData } from '../services/spaceWeather';
import { fetchFlareProbabilities } from '../services/solarActivity';
import { fetchNews } from '../services/news';
import './Carousel.css';

function getKpLabel(kp) {
  if (kp >= 7) return 'Strong Storm';
  if (kp >= 5) return 'Storm';
  if (kp >= 3) return 'Unsettled';
  return 'Quiet';
}

function getFlareLabel(probs) {
  if (probs.x >= 25) return 'High';
  if (probs.m >= 25) return 'Moderate';
  if (probs.c >= 50) return 'Active';
  return 'Low';
}

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const Carousel = () => {
  const [kp, setKp] = useState(null);
  const [bz, setBz] = useState(null);
  const [flareLabel, setFlareLabel] = useState(null);
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadBadgeData = async () => {
      const [kpResult, magResult, flareResult] = await Promise.allSettled([
        fetchKpIndex(),
        fetchMagneticFieldData(),
        fetchFlareProbabilities(),
      ]);

      if (!mounted) return;

      if (kpResult.status === 'fulfilled' && kpResult.value.length > 0) {
        const latest = kpResult.value[kpResult.value.length - 1];
        setKp(latest.kp);
      }

      if (magResult.status === 'fulfilled' && magResult.value.length > 0) {
        const latest = magResult.value[magResult.value.length - 1];
        setBz(latest.bz);
      }

      if (flareResult.status === 'fulfilled') {
        setFlareLabel(getFlareLabel(flareResult.value));
      }
    };

    const loadNews = async () => {
      try {
        const news = await fetchNews();
        if (mounted) setArticles(news);
      } catch (err) {
        console.warn('Failed to load news:', err);
      }
    };

    loadBadgeData();
    loadNews();

    const badgeInterval = setInterval(loadBadgeData, 60_000);
    const newsInterval = setInterval(loadNews, 15 * 60_000);

    return () => {
      mounted = false;
      clearInterval(badgeInterval);
      clearInterval(newsInterval);
    };
  }, []);

  return (
    <div className="carousel">
      <div className="carousel__header">
        <div className="carousel__badges">
          <span className="carousel__metric carousel__metric--kp">
            {kp !== null ? `KP: ${Math.round(kp)} \u00B7 ${getKpLabel(kp)}` : 'KP: --'}
          </span>
          <span className="carousel__metric carousel__metric--flare">
            {flareLabel !== null ? `Flares: ${flareLabel}` : 'Flares: --'}
          </span>
          <span className="carousel__metric carousel__metric--bz">
            {bz !== null ? `Bz: ${bz > 0 ? '+' : ''}${bz.toFixed(1)} nT` : 'Bz: --'}
          </span>
        </div>
      </div>
      <div className="carousel__track">
        {articles.length === 0 && (
          <div className="carousel__card carousel__news-card">
            <div className="carousel__news-loading">Loading news...</div>
          </div>
        )}
        {articles.map((article, index) => (
          <a
            key={article.link}
            className="carousel__card carousel__news-card"
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <h3 className="carousel__news-title">{article.title}</h3>
            <div className="carousel__news-meta">
              {article.source && (
                <span className="carousel__news-source">{article.source}</span>
              )}
              {article.pubDate && (
                <span className="carousel__news-time">{timeAgo(article.pubDate)}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default Carousel;
