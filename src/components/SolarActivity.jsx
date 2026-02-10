import { useEffect, useMemo, useState } from 'react';
import {
  fetchActiveRegions,
  fetchEnlilFrames,
  fetchFlareProbabilities,
  fetchLastModified,
  fetchXrayFlux,
  LASCO_C2_GIF_URL,
  LASCO_C3_GIF_URL,
  MAGNETOGRAM_URL,
} from '../services/solarActivity';
import LineChart from './LineChart';
import './SolarActivity.css';

const SolarActivity = () => {
  const [flareProbabilities, setFlareProbabilities] = useState({
    c: 0,
    m: 0,
    x: 0,
  });
  const [imagery, setImagery] = useState({
    magnetogram: { url: MAGNETOGRAM_URL, timestamp: null, regions: [] },
    lascoC2: { url: LASCO_C2_GIF_URL, timestamp: null },
    lascoC3: { url: LASCO_C3_GIF_URL, timestamp: null },
    enlil: { frames: [], timestamp: null },
  });
  const [enlilFrameIndex, setEnlilFrameIndex] = useState(0);
  const [xrayData, setXrayData] = useState([]);
  const [xrayLoading, setXrayLoading] = useState(true);
  const [xrayError, setXrayError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageryLoading, setImageryLoading] = useState(true);
  const [imageryError, setImageryError] = useState(null);

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

  useEffect(() => {
    let isMounted = true;

    const loadXray = async () => {
      try {
        setXrayError(null);
        const data = await fetchXrayFlux();
        if (isMounted) {
          setXrayData(data);
        }
      } catch (err) {
        if (isMounted) {
          setXrayError(err.message ?? 'Unable to load X-ray flux.');
        }
      } finally {
        if (isMounted) {
          setXrayLoading(false);
        }
      }
    };

    loadXray();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadImagery = async () => {
      try {
        setImageryError(null);
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [regions, magnetogramTime, lascoC2Time, lascoC3Time, enlilData] =
          await Promise.all([
            fetchActiveRegions(start, now),
            fetchLastModified(MAGNETOGRAM_URL),
            fetchLastModified(LASCO_C2_GIF_URL),
            fetchLastModified(LASCO_C3_GIF_URL),
            fetchEnlilFrames(),
          ]);

        if (!isMounted) {
          return;
        }

        setImagery({
          magnetogram: {
            url: MAGNETOGRAM_URL,
            timestamp: magnetogramTime,
            regions,
          },
          lascoC2: {
            url: LASCO_C2_GIF_URL,
            timestamp: lascoC2Time,
          },
          lascoC3: {
            url: LASCO_C3_GIF_URL,
            timestamp: lascoC3Time,
          },
          enlil: enlilData,
        });
      } catch (err) {
        if (isMounted) {
          setImageryError(err.message ?? 'Unable to load solar imagery.');
        }
      } finally {
        if (isMounted) {
          setImageryLoading(false);
        }
      }
    };

    loadImagery();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!imagery.enlil.frames.length) {
      return undefined;
    }

    const interval = setInterval(() => {
      setEnlilFrameIndex(index => (index + 1) % imagery.enlil.frames.length);
    }, 200);

    return () => clearInterval(interval);
  }, [imagery.enlil.frames.length]);

  const enlilFrame = imagery.enlil.frames[enlilFrameIndex];

  const regionMarkers = useMemo(
    () =>
      imagery.magnetogram.regions.map(region => {
        const x = 512 + (region.x / 1000) * 512;
        const y = 512 - (region.y / 1000) * 512;
        return {
          id: region.id,
          number: region.number,
          left: `${(x / 1024) * 100}%`,
          top: `${(y / 1024) * 100}%`,
        };
      }),
    [imagery.magnetogram.regions]
  );

  const formatTimestamp = timestamp => {
    if (!timestamp) {
      return null;
    }
    return timestamp.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
  };

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

      <div className="solar-activity__section">
        <h3 className="solar-activity__section-title">Solar Imagery</h3>
        {imageryLoading ? (
          <div className="panel solar-activity__placeholder">Loading solar imagery...</div>
        ) : imageryError ? (
          <div className="panel solar-activity__placeholder">{imageryError}</div>
        ) : (
          <div className="solar-activity__carousel">
            <div className="solar-activity__carousel-track" role="list">
              <article className="solar-activity__card" role="listitem">
                <div className="solar-activity__card-header">
                  <h4>HMI Magnetogram</h4>
                  <span className="solar-activity__source">SDO</span>
                </div>
                <div className="solar-activity__image-frame">
                  <img src={imagery.magnetogram.url} alt="HMI magnetogram" />
                  {regionMarkers.map(marker => (
                    <span
                      key={marker.id}
                      className="solar-activity__region"
                      style={{ left: marker.left, top: marker.top }}
                    >
                      {marker.number}
                    </span>
                  ))}
                </div>
                {imagery.magnetogram.timestamp ? (
                  <span className="solar-activity__caption">
                    Updated {formatTimestamp(imagery.magnetogram.timestamp)} UTC
                  </span>
                ) : null}
              </article>

              <article className="solar-activity__card" role="listitem">
                <div className="solar-activity__card-header">
                  <h4>LASCO C2</h4>
                  <span className="solar-activity__source">SOHO</span>
                </div>
                <div className="solar-activity__image-frame">
                  <img src={imagery.lascoC2.url} alt="LASCO C2 coronagraph" />
                </div>
                {imagery.lascoC2.timestamp ? (
                  <span className="solar-activity__caption">
                    Updated {formatTimestamp(imagery.lascoC2.timestamp)} UTC
                  </span>
                ) : null}
              </article>

              <article className="solar-activity__card" role="listitem">
                <div className="solar-activity__card-header">
                  <h4>LASCO C3</h4>
                  <span className="solar-activity__source">SOHO</span>
                </div>
                <div className="solar-activity__image-frame">
                  <img src={imagery.lascoC3.url} alt="LASCO C3 coronagraph" />
                </div>
                {imagery.lascoC3.timestamp ? (
                  <span className="solar-activity__caption">
                    Updated {formatTimestamp(imagery.lascoC3.timestamp)} UTC
                  </span>
                ) : null}
              </article>

              <article className="solar-activity__card" role="listitem">
                <div className="solar-activity__card-header">
                  <h4>WSA-Enlil</h4>
                  <span className="solar-activity__source">NOAA</span>
                </div>
                <div className="solar-activity__image-frame solar-activity__image-frame--contain">
                  {enlilFrame ? (
                    <img
                      key={enlilFrame}
                      className="solar-activity__image--fade"
                      src={enlilFrame}
                      alt="WSA-Enlil solar wind model"
                    />
                  ) : (
                    <div className="solar-activity__image-fallback">
                      No animation frames
                    </div>
                  )}
                </div>
                {imagery.enlil.timestamp ? (
                  <span className="solar-activity__caption">
                    Run {formatTimestamp(imagery.enlil.timestamp)} UTC
                  </span>
                ) : null}
              </article>
            </div>
          </div>
        )}
      </div>
      <div className="solar-activity__section">
        <h3 className="solar-activity__section-title">X-Ray Activity</h3>
        {xrayLoading ? (
          <div className="panel solar-activity__placeholder">Loading X-ray flux...</div>
        ) : xrayError ? (
          <div className="panel solar-activity__placeholder">{xrayError}</div>
        ) : (
          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>GOES X-Ray Flux</h3>
              <span>72 Hour</span>
            </div>
            <LineChart
              data={xrayData}
              yScale="log"
              yDomain={[1e-9, 1e-2]}
              yTickFormatter={value => value.toExponential(0)}
              series={[
                { key: 'goes18Short', color: '#5ac8fa', label: 'GOES-18 Short' },
                { key: 'goes18Long', color: '#34c759', label: 'GOES-18 Long' },
                { key: 'goes19Short', color: '#ff9f0a', label: 'GOES-19 Short' },
                { key: 'goes19Long', color: '#ff375f', label: 'GOES-19 Long' },
              ]}
            />
          </div>
        )}
      </div>
      <div className="panel solar-activity__placeholder">Recent flares loading.</div>
      <div className="panel solar-activity__placeholder">Particle environment loading.</div>
    </section>
  );
};

export default SolarActivity;
