import { useEffect, useMemo, useRef, useState } from 'react';
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const usePinchZoom = () => {
  const ref = useRef(null);
  const pointers = useRef(new Map());
  const startDistance = useRef(0);
  const startScale = useRef(1);
  const panStart = useRef({ x: 0, y: 0, pointerX: 0, pointerY: 0 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

  const clampTranslate = (x, y, scale) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) {
      return { x, y };
    }
    const maxX = ((scale - 1) * rect.width) / 2;
    const maxY = ((scale - 1) * rect.height) / 2;
    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  };

  const onPointerDown = event => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size === 1) {
      panStart.current = {
        x: transform.x,
        y: transform.y,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
    }

    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      startDistance.current = distanceBetween(first, second);
      startScale.current = transform.scale;
    }
  };

  const onPointerMove = event => {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      const distance = distanceBetween(first, second);
      if (startDistance.current > 0) {
        const nextScale = clamp(
          startScale.current * (distance / startDistance.current),
          1,
          3
        );
        setTransform(prev => {
          const clamped = clampTranslate(prev.x, prev.y, nextScale);
          return { ...prev, scale: nextScale, ...clamped };
        });
      }
      return;
    }

    if (pointers.current.size === 1 && transform.scale > 1) {
      const deltaX = event.clientX - panStart.current.pointerX;
      const deltaY = event.clientY - panStart.current.pointerY;
      const nextX = panStart.current.x + deltaX;
      const nextY = panStart.current.y + deltaY;
      setTransform(prev => ({
        ...prev,
        ...clampTranslate(nextX, nextY, prev.scale),
      }));
    }
  };

  const resetPointers = event => {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.delete(event.pointerId);
    }
    if (pointers.current.size < 2) {
      startDistance.current = 0;
    }
  };

  const resetZoom = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: resetPointers,
    onPointerCancel: resetPointers,
    onPointerLeave: resetPointers,
    onDoubleClick: resetZoom,
    touchAction: transform.scale > 1 ? 'none' : 'pan-x',
    style: {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    },
  };
};

const SolarActivity = () => {
  const [flareProbabilities, setFlareProbabilities] = useState({
    c: 0,
    m: 0,
    x: 0,
  });
  const magnetogramZoom = usePinchZoom();
  const lascoC2Zoom = usePinchZoom();
  const lascoC3Zoom = usePinchZoom();
  const enlilZoom = usePinchZoom();
  const [imagery, setImagery] = useState({
    magnetogram: { url: MAGNETOGRAM_URL, timestamp: null, regions: [] },
    lascoC2: { url: LASCO_C2_GIF_URL, timestamp: null },
    lascoC3: { url: LASCO_C3_GIF_URL, timestamp: null },
    enlil: { frames: [], timestamp: null },
  });
  const enlilCanvasRef = useRef(null);
  const enlilImagesRef = useRef([]);
  const enlilAnimationRef = useRef(null);
  const enlilFrameRef = useRef(0);
  const enlilLastFrameTimeRef = useRef(0);
  const [enlilLoading, setEnlilLoading] = useState(true);
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
    let isMounted = true;
    const frames = imagery.enlil.frames;

    if (!frames.length) {
      enlilImagesRef.current = [];
      setEnlilLoading(false);
      return undefined;
    }

    const loadFrames = async () => {
      setEnlilLoading(true);
      const images = await Promise.all(
        frames.map(url =>
          new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          })
        )
      );

      if (!isMounted) {
        return;
      }

      enlilImagesRef.current = images.filter(Boolean);
      enlilFrameRef.current = 0;
      enlilLastFrameTimeRef.current = 0;
      setEnlilLoading(false);
      startEnlilAnimation();
    };

    loadFrames();

    return () => {
      isMounted = false;
      if (enlilAnimationRef.current) {
        cancelAnimationFrame(enlilAnimationRef.current);
      }
    };
  }, [imagery.enlil.frames]);

  useEffect(() => {
    if (!enlilImagesRef.current.length) {
      return undefined;
    }

    const canvas = enlilCanvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');

    const setupCanvas = () => {
      const size = canvas.offsetWidth;
      if (!size) {
        return;
      }
      const devicePixelRatio = window.devicePixelRatio || 1;
      const firstImage = enlilImagesRef.current[0];
      const maxDpr = firstImage ? firstImage.naturalWidth / size : devicePixelRatio;
      const dpr = Math.min(devicePixelRatio, maxDpr || devicePixelRatio);

      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };

    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [enlilLoading]);

  const startEnlilAnimation = () => {
    const canvas = enlilCanvasRef.current;
    if (!canvas || !enlilImagesRef.current.length) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const frameDelay = 200;

    const drawFrame = timestamp => {
      const size = canvas.offsetWidth;
      if (!size) {
        return;
      }

      if (!enlilLastFrameTimeRef.current) {
        enlilLastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - enlilLastFrameTimeRef.current;
      const progress = Math.min(elapsed / frameDelay, 1);
      const currentIndex = enlilFrameRef.current;
      const nextIndex = (currentIndex + 1) % enlilImagesRef.current.length;
      const currentImage = enlilImagesRef.current[currentIndex];
      const nextImage = enlilImagesRef.current[nextIndex];

      ctx.clearRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      if (currentImage) {
        ctx.drawImage(currentImage, 0, 0, size, size);
      }

      if (nextImage) {
        ctx.globalAlpha = progress;
        ctx.drawImage(nextImage, 0, 0, size, size);
        ctx.globalAlpha = 1;
      }

      if (elapsed >= frameDelay) {
        enlilLastFrameTimeRef.current = timestamp;
        enlilFrameRef.current = nextIndex;
      }

      enlilAnimationRef.current = requestAnimationFrame(drawFrame);
    };

    if (enlilAnimationRef.current) {
      cancelAnimationFrame(enlilAnimationRef.current);
    }
    enlilAnimationRef.current = requestAnimationFrame(drawFrame);
  };

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
                <div
                  className="solar-activity__image-frame solar-activity__image-frame--zoomable"
                  ref={magnetogramZoom.ref}
                  onPointerDown={magnetogramZoom.onPointerDown}
                  onPointerMove={magnetogramZoom.onPointerMove}
                  onPointerUp={magnetogramZoom.onPointerUp}
                  onPointerCancel={magnetogramZoom.onPointerCancel}
                  onPointerLeave={magnetogramZoom.onPointerLeave}
                  onDoubleClick={magnetogramZoom.onDoubleClick}
                  style={{ touchAction: magnetogramZoom.touchAction }}
                >
                  <div className="solar-activity__zoom" style={magnetogramZoom.style}>
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
                <div
                  className="solar-activity__image-frame solar-activity__image-frame--zoomable"
                  ref={lascoC2Zoom.ref}
                  onPointerDown={lascoC2Zoom.onPointerDown}
                  onPointerMove={lascoC2Zoom.onPointerMove}
                  onPointerUp={lascoC2Zoom.onPointerUp}
                  onPointerCancel={lascoC2Zoom.onPointerCancel}
                  onPointerLeave={lascoC2Zoom.onPointerLeave}
                  onDoubleClick={lascoC2Zoom.onDoubleClick}
                  style={{ touchAction: lascoC2Zoom.touchAction }}
                >
                  <div className="solar-activity__zoom" style={lascoC2Zoom.style}>
                    <img src={imagery.lascoC2.url} alt="LASCO C2 coronagraph" />
                  </div>
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
                <div
                  className="solar-activity__image-frame solar-activity__image-frame--zoomable"
                  ref={lascoC3Zoom.ref}
                  onPointerDown={lascoC3Zoom.onPointerDown}
                  onPointerMove={lascoC3Zoom.onPointerMove}
                  onPointerUp={lascoC3Zoom.onPointerUp}
                  onPointerCancel={lascoC3Zoom.onPointerCancel}
                  onPointerLeave={lascoC3Zoom.onPointerLeave}
                  onDoubleClick={lascoC3Zoom.onDoubleClick}
                  style={{ touchAction: lascoC3Zoom.touchAction }}
                >
                  <div className="solar-activity__zoom" style={lascoC3Zoom.style}>
                    <img src={imagery.lascoC3.url} alt="LASCO C3 coronagraph" />
                  </div>
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
                <div
                  className="solar-activity__image-frame solar-activity__image-frame--contain solar-activity__image-frame--zoomable"
                  ref={enlilZoom.ref}
                  onPointerDown={enlilZoom.onPointerDown}
                  onPointerMove={enlilZoom.onPointerMove}
                  onPointerUp={enlilZoom.onPointerUp}
                  onPointerCancel={enlilZoom.onPointerCancel}
                  onPointerLeave={enlilZoom.onPointerLeave}
                  onDoubleClick={enlilZoom.onDoubleClick}
                  style={{ touchAction: enlilZoom.touchAction }}
                >
                  <div className="solar-activity__zoom" style={enlilZoom.style}>
                    {enlilLoading ? (
                      <div className="solar-activity__image-fallback">
                        Loading animation...
                      </div>
                    ) : enlilImagesRef.current.length ? (
                      <canvas
                        ref={enlilCanvasRef}
                        className="solar-activity__canvas"
                        aria-label="WSA-Enlil solar wind model"
                      />
                    ) : (
                      <div className="solar-activity__image-fallback">
                        No animation frames
                      </div>
                    )}
                  </div>
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
