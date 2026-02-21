import { useCallback, useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import './AuroraGlobe.css';

// ─── Aurora intensity → RGBA color scale ────────────────────────────────────
// Values observed in NOAA OVATION data:
//   Quiet day  : 2–8    (faint green/teal ring)
//   Active     : 9–20   (bright green)
//   Storm      : 21–50  (yellow-green → orange)
//   Major storm: 50+    (red / white)
const COLOR_BANDS = [
  { min: 2,  color: 'rgba(0, 220, 180, 0.40)' },  // faint teal
  { min: 4,  color: 'rgba(0, 255, 120, 0.65)' },  // green
  { min: 9,  color: 'rgba(80, 255, 60, 0.85)'  },  // bright green
  { min: 16, color: 'rgba(200, 255, 0, 0.95)'  },  // yellow-green
  { min: 26, color: 'rgba(255, 180, 0, 1.0)'   },  // orange
  { min: 41, color: 'rgba(255, 80, 80, 1.0)'   },  // red / extreme
];

function auroraColor(intensity) {
  let color = 'rgba(0,0,0,0)';
  for (const band of COLOR_BANDS) {
    if (intensity >= band.min) color = band.color;
    else break;
  }
  return color;
}

function formatUtcTime(date) {
  if (!date || Number.isNaN(date.valueOf())) return '—';
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${mo}/${d}  ${h}:${m} UTC`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const AuroraGlobe = ({ ovationData }) => {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [dims, setDims] = useState({ w: 400, h: 400 });

  // Keep globe canvas sized to its container via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.round(el.offsetWidth);
      if (w > 0) setDims({ w, h: w });
    };

    measure(); // initial
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Once the globe WebGL scene is ready, point the camera and start rotation
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // Arctic / North-Atlantic view so the aurora oval is visible on load
    globe.pointOfView({ lat: 62, lng: -50, altitude: 1.75 }, 0);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enablePan = false;
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!ovationData) {
    return (
      <div className="aurora-globe aurora-globe--loading-state" ref={containerRef}>
        <div className="aurora-globe__loading">
          <div className="aurora-globe__spinner" />
          <p>Loading aurora model…</p>
        </div>
      </div>
    );
  }

  // ── Globe ─────────────────────────────────────────────────────────────────
  return (
    <div className="aurora-globe" ref={containerRef}>
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#1a90ff"
        atmosphereAltitude={0.14}
        pointsData={ovationData.points}
        pointLat={d => d.lat}
        pointLng={d => d.lng}
        pointColor={d => auroraColor(d.intensity)}
        pointAltitude={0.005}
        pointRadius={0.7}
        onGlobeReady={handleGlobeReady}
      />

      {/* ── Source label (top-left) ─────────────────────────── */}
      <div className="aurora-globe__source">NOAA OVATION</div>

      {/* ── LIVE badge + timestamp (top-right) ─────────────── */}
      <div className="aurora-globe__badge">
        <div className="aurora-globe__badge-pill">
          <span className="aurora-globe__badge-dot" />
          <span>Live</span>
        </div>
        {ovationData.observationTime && (
          <span className="aurora-globe__timestamp">
            Observed {formatUtcTime(ovationData.observationTime)}
          </span>
        )}
      </div>

      {/* ── Color intensity legend (bottom-left) ───────────── */}
      <div className="aurora-globe__legend">
        <span className="aurora-globe__legend-item aurora-globe__legend-item--weak">Weak</span>
        <span className="aurora-globe__legend-item aurora-globe__legend-item--moderate">Moderate</span>
        <span className="aurora-globe__legend-item aurora-globe__legend-item--strong">Strong</span>
        <span className="aurora-globe__legend-item aurora-globe__legend-item--severe">Severe</span>
        <span className="aurora-globe__legend-item aurora-globe__legend-item--extreme">Extreme</span>
      </div>
    </div>
  );
};

export default AuroraGlobe;
