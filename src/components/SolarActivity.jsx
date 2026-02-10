import { useEffect, useState } from 'react';
import { fetchFlareProbabilities } from '../services/solarActivity';
import './SolarActivity.css';

const SolarActivity = () => {
  const [flareProbabilities, setFlareProbabilities] = useState({
    c: 0,
    m: 0,
    x: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadProbabilities = async () => {
      try {
        setError(null);
        const probabilities = await fetchFlareProbabilities();
        if (isMounted) {
          setFlareProbabilities(probabilities);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message ?? 'Unable to load flare probabilities.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProbabilities();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="solar-activity">
      <header className="solar-activity__header">
        <h2 className="solar-activity__title">Solar Activity</h2>
      </header>

      <div className="solar-activity__badges">
        {isLoading ? (
          <span className="solar-activity__status">Loading flare probabilities...</span>
        ) : error ? (
          <span className="solar-activity__status">{error}</span>
        ) : (
          <>
            <span className="metric-badge metric-badge--flare-c">
              C: {flareProbabilities.c}%
            </span>
            <span className="metric-badge metric-badge--flare-m">
              M: {flareProbabilities.m}%
            </span>
            <span className="metric-badge metric-badge--flare-x">
              X: {flareProbabilities.x}%
            </span>
          </>
        )}
      </div>

      <div className="panel solar-activity__placeholder">Solar imagery loading.</div>
      <div className="panel solar-activity__placeholder">X-Ray activity loading.</div>
      <div className="panel solar-activity__placeholder">Recent flares loading.</div>
      <div className="panel solar-activity__placeholder">Particle environment loading.</div>
    </section>
  );
};

export default SolarActivity;
