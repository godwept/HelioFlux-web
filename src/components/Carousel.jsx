import { useEffect, useState } from 'react';
import { fetchKpIndex, fetchMagneticFieldData } from '../services/spaceWeather';
import { fetchFlareProbabilities } from '../services/solarActivity';
import { fetchForecastDiscussion } from '../services/news';
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

function formatIssueTime(str) {
  if (!str) return str;
  const m = str.match(/(\d{4})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})\s+UTC/);
  if (!m) return str;
  const [, , mon, day, hhmm] = m;
  return `${mon} ${day}, ${hhmm.slice(0, 2)}:${hhmm.slice(2)} UTC`;
}

const Carousel = () => {
  const [kp, setKp] = useState(null);
  const [bz, setBz] = useState(null);
  const [flareLabel, setFlareLabel] = useState(null);
  const [sections, setSections] = useState([]);

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

    const loadDiscussion = async () => {
      try {
        const data = await fetchForecastDiscussion();
        if (mounted) setSections(data);
      } catch (err) {
        console.warn('Failed to load forecast discussion:', err);
      }
    };

    loadBadgeData();
    loadDiscussion();

    const badgeInterval = setInterval(loadBadgeData, 60_000);
    const discussionInterval = setInterval(loadDiscussion, 60 * 60_000);

    return () => {
      mounted = false;
      clearInterval(badgeInterval);
      clearInterval(discussionInterval);
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
        {sections.length === 0 && (
          <div className="carousel__card carousel__forecast-card">
            <div className="carousel__forecast-loading">Loading forecast...</div>
          </div>
        )}
        {sections.map(section => (
          <div
            key={section.key}
            className={`carousel__card carousel__forecast-card carousel__forecast-card--${section.key}`}
          >
            <h3 className="carousel__forecast-title">{section.title}</h3>
            {section.summary && (
              <div className="carousel__forecast-section">
                <span className="carousel__forecast-label">24hr Summary</span>
                <p className="carousel__forecast-text">{section.summary}</p>
              </div>
            )}
            {section.forecast && (
              <div className="carousel__forecast-section">
                <span className="carousel__forecast-label">Forecast</span>
                <p className="carousel__forecast-text">{section.forecast}</p>
              </div>
            )}
            {section.issueTime && (
              <p className="carousel__forecast-issued">Issued {formatIssueTime(section.issueTime)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Carousel;
