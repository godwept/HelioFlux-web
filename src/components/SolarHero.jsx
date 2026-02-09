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

  // Target ~5 FPS (200ms per frame)
  const FRAME_DELAY = 200;

  useEffect(() => {
    let mounted = true;

    const loadFrames = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const urls = await fetchSolarFrames();
        
        if (!mounted) return;
        
        // Preload all images
        const images = await Promise.all(
          urls.map(url => {
            return new Promise((resolve) => {
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
    
    const drawFrame = () => {
      const img = imagesRef.current[currentFrameRef.current];
      
      if (img && img.complete) {
        // Set canvas size to match image (or container size)
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetWidth; // Square aspect ratio
        
        // Draw image to fill canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      // Move to next frame
      currentFrameRef.current = (currentFrameRef.current + 1) % imagesRef.current.length;
      
      // Schedule next frame
      animationRef.current = setTimeout(drawFrame, FRAME_DELAY);
    };

    drawFrame();
  };

  // Pause animation when tab is hidden (battery optimization)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
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
      {!loading && (
        <div className="solar-hero__badge">
          <span className="solar-hero__badge-dot" />
          <span>Live AIA 304Å</span>
        </div>
      )}
    </div>
  );
};

export default SolarHero;
