import { useEffect, useRef, useState } from 'react';
import { fetchSolarFrames } from '../services/helioviewer';
import './SolarHero.css';

const SolarHero = () => {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const animationRef = useRef(null);
  const imagesRef = useRef([]);
  const currentFrameRef = useRef(0);
  const sizingLoggedRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const animationStartRef = useRef(0);

  // Zoom / pan state (refs so the animation loop always reads the latest value)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Target ~5 FPS (200ms per frame)
  const FRAME_DELAY = 200;
  const CACHE_KEY = 'helioflux-solar-frames';
  const CACHE_TTL = 30 * 60 * 1000;

  useEffect(() => {
    let mounted = true;

    const loadFrames = async () => {
      try {
        setLoading(true);
        setError(null);
        const now = Date.now();
        let urls = [];

        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
          if (cached.timestamp && Array.isArray(cached.urls)) {
            const age = now - cached.timestamp;
            if (age < CACHE_TTL) {
              urls = cached.urls;
            }
          }
        } catch (cacheError) {
          console.warn('SolarHero cache read failed:', cacheError);
        }

        if (!urls.length) {
          urls = await fetchSolarFrames();
          try {
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ timestamp: now, urls })
            );
          } catch (cacheError) {
            console.warn('SolarHero cache write failed:', cacheError);
          }
        }
        
        if (!mounted) return;
        
        // Preload all images
        const images = await Promise.all(
          urls.map(url => {
            return new Promise(resolve => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => resolve(img);
              img.onerror = () => {
                console.error(`Failed to load image: ${url}`);
                // Return a placeholder or null
                resolve(null);
              };
              img.src = url;
            });
          })
        );

        if (!mounted) return;

        // Filter out failed images
        imagesRef.current = images.filter(img => img !== null);

        if (imagesRef.current.length > 0) {
          const firstImage = imagesRef.current[0];
          console.log('SolarHero first frame size:', firstImage.naturalWidth, firstImage.naturalHeight);
        }
        
        if (imagesRef.current.length === 0) {
          throw new Error('Failed to load any images');
        }

        setLoading(false);
        startAnimation();
      } catch (err) {
        console.error('Error loading solar frames:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadFrames();

    return () => {
      mounted = false;
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  const startAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas || imagesRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');

    const drawFrame = (timestamp) => {
      const size = canvas.offsetWidth;
      if (size <= 0) return;

      if (!animationStartRef.current) {
        animationStartRef.current = timestamp;
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const progress = Math.min(elapsed / FRAME_DELAY, 1);

      const currentIndex = currentFrameRef.current;
      const nextIndex = (currentIndex + 1) % imagesRef.current.length;
      const currentImage = imagesRef.current[currentIndex];
      const nextImage = imagesRef.current[nextIndex];

      if (currentImage && currentImage.complete && size > 0) {
        if (!sizingLoggedRef.current) {
          console.log('SolarHero canvas vs image:', {
            canvasSize: size,
            imageSize: {
              width: currentImage.naturalWidth,
              height: currentImage.naturalHeight,
            },
            devicePixelRatio: window.devicePixelRatio || 1,
          });
          sizingLoggedRef.current = true;
        }

        const z = zoomRef.current;
        const { x: px, y: py } = panRef.current;

        ctx.clearRect(0, 0, size, size);
        ctx.save();
        // Zoom centred on canvas middle; pan offsets from that centre
        ctx.translate(size / 2 + px, size / 2 + py);
        ctx.scale(z, z);
        ctx.translate(-size / 2, -size / 2);

        ctx.globalAlpha = 1;
        ctx.drawImage(currentImage, 0, 0, size, size);

        if (nextImage && nextImage.complete) {
          ctx.globalAlpha = progress;
          ctx.drawImage(nextImage, 0, 0, size, size);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      if (elapsed >= FRAME_DELAY) {
        lastFrameTimeRef.current = timestamp;
        currentFrameRef.current = nextIndex;
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);
  };

  useEffect(() => {
    if (loading || error) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const setupCanvas = () => {
      const size = canvas.offsetWidth;
      if (!size) return;

      const devicePixelRatio = window.devicePixelRatio || 1;
      const firstImage = imagesRef.current[0];
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

    return () => {
      window.removeEventListener('resize', setupCanvas);
    };
  }, [loading, error]);

  // ── Pinch / scroll zoom + drag-to-pan ────────────────────────────────────
  useEffect(() => {
    if (loading || error) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 4;

    // Clamp pan so the image never fully leaves the canvas
    const clampPan = (x, y, z) => {
      const limit = (canvas.offsetWidth / 2) * (z - 1);
      return {
        x: Math.max(-limit, Math.min(limit, x)),
        y: Math.max(-limit, Math.min(limit, y)),
      };
    };

    // ── Mouse wheel zoom ──
    const onWheel = e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
      zoomRef.current = next;
      if (next === 1) panRef.current = { x: 0, y: 0 };
      else panRef.current = clampPan(panRef.current.x, panRef.current.y, next);
    };

    // ── Pinch-to-zoom ──
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    const onTouchStart = e => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = zoomRef.current;
      }
    };

    const onTouchMove = e => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom * (dist / pinchStartDist)));
      zoomRef.current = next;
      if (next === 1) panRef.current = { x: 0, y: 0 };
      else panRef.current = clampPan(panRef.current.x, panRef.current.y, next);
    };

    // ── 1-finger drag to pan (only when zoomed in) ──
    let dragStart = null;
    let panAtDragStart = { x: 0, y: 0 };

    const onDragStart = e => {
      if (e.touches && e.touches.length !== 1) return;
      if (zoomRef.current <= 1) return;
      const point = e.touches ? e.touches[0] : e;
      dragStart = { x: point.clientX, y: point.clientY };
      panAtDragStart = { ...panRef.current };
    };

    const onDragMove = e => {
      if (!dragStart) return;
      if (e.touches && e.touches.length !== 1) { dragStart = null; return; }
      e.preventDefault();
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - dragStart.x;
      const dy = point.clientY - dragStart.y;
      panRef.current = clampPan(
        panAtDragStart.x + dx,
        panAtDragStart.y + dy,
        zoomRef.current
      );
    };

    const onDragEnd = () => { dragStart = null; };

    // ── Double-tap/double-click to reset ──
    let lastTap = 0;
    const onDoubleTap = () => {
      const now = Date.now();
      if (now - lastTap < 300) { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }
      lastTap = now;
    };

    canvas.addEventListener('wheel',      onWheel,     { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchstart', onDragStart,  { passive: true });
    canvas.addEventListener('touchmove',  onDragMove,   { passive: false });
    canvas.addEventListener('touchend',   onDragEnd,    { passive: true });
    canvas.addEventListener('mousedown',  onDragStart);
    canvas.addEventListener('mousemove',  onDragMove);
    canvas.addEventListener('mouseup',    onDragEnd);
    canvas.addEventListener('mouseleave', onDragEnd);
    canvas.addEventListener('click',      onDoubleTap);

    return () => {
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchstart', onDragStart);
      canvas.removeEventListener('touchmove',  onDragMove);
      canvas.removeEventListener('touchend',   onDragEnd);
      canvas.removeEventListener('mousedown',  onDragStart);
      canvas.removeEventListener('mousemove',  onDragMove);
      canvas.removeEventListener('mouseup',    onDragEnd);
      canvas.removeEventListener('mouseleave', onDragEnd);
      canvas.removeEventListener('click',      onDoubleTap);
    };
  }, [loading, error]);

  // Pause animation when tab is hidden (battery optimization)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      } else if (!loading && !error && imagesRef.current.length > 0) {
        startAnimation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading, error]);

  if (error) {
    return (
      <div className="solar-hero solar-hero--error">
        <div className="solar-hero__error">
          <p>Unable to load solar imagery</p>
          <p className="solar-hero__error-detail">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="solar-hero">
      {loading && (
        <div className="solar-hero__loading">
          <div className="solar-hero__spinner" />
          <p>Loading solar imagery...</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`solar-hero__canvas ${loading ? 'solar-hero__canvas--hidden' : ''}`}
      />
    </div>
  );
};

export default SolarHero;
