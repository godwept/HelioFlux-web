import { useEffect, useState } from 'react';
import { fetchKpIndex, fetchMagneticFieldData, fetchProtonFlux } from '../services/spaceWeather';
import { fetchFlareProbabilities, fetchXrayFlux } from '../services/solarActivity';
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

function getGScale(kp) {
  if (kp >= 9) return { level: 'G5', label: 'Extreme', severity: 'extreme' };
  if (kp >= 8) return { level: 'G4', label: 'Severe', severity: 'severe' };
  if (kp >= 7) return { level: 'G3', label: 'Strong', severity: 'strong' };
  if (kp >= 6) return { level: 'G2', label: 'Moderate', severity: 'moderate' };
  if (kp >= 5) return { level: 'G1', label: 'Minor', severity: 'minor' };
  return { level: 'G0', label: 'None', severity: 'none' };
}

function getSScale(flux) {
  if (flux >= 1e5) return { level: 'S5', label: 'Extreme', severity: 'extreme' };
  if (flux >= 1e4) return { level: 'S4', label: 'Severe', severity: 'severe' };
  if (flux >= 1e3) return { level: 'S3', label: 'Strong', severity: 'strong' };
  if (flux >= 1e2) return { level: 'S2', label: 'Moderate', severity: 'moderate' };
  if (flux >= 10) return { level: 'S1', label: 'Minor', severity: 'minor' };
  return { level: 'S0', label: 'None', severity: 'none' };
}

function getRScale(flux) {
  if (flux >= 1e-2) return { level: 'R5', label: 'Extreme', severity: 'extreme' };
  if (flux >= 1e-3) return { level: 'R4', label: 'Severe', severity: 'severe' };
  if (flux >= 1e-4) return { level: 'R3', label: 'Strong', severity: 'strong' };
  if (flux >= 5e-5) return { level: 'R2', label: 'Moderate', severity: 'moderate' };
  if (flux >= 1e-5) return { level: 'R1', label: 'Minor', severity: 'minor' };
  return { level: 'R0', label: 'None', severity: 'none' };
}

function formatProtonFlux(flux) {
  if (flux >= 100) return `${Math.round(flux)} pfu`;
  if (flux >= 1) return `${flux.toFixed(1)} pfu`;
  return `${flux.toFixed(2)} pfu`;
}

function formatXrayClass(flux) {
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
}

const Carousel = () => {
  const [kp, setKp] = useState(null);
  const [bz, setBz] = useState(null);
  const [flareLabel, setFlareLabel] = useState(null);
  const [protonFlux, setProtonFlux] = useState(null);
  const [xrayFlux, setXrayFlux] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      const [kpResult, magResult, flareResult, protonResult, xrayResult] =
        await Promise.allSettled([
          fetchKpIndex(),
          fetchMagneticFieldData(),
          fetchFlareProbabilities(),
          fetchProtonFlux(),
          fetchXrayFlux(),
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

      if (protonResult.status === 'fulfilled' && protonResult.value.length > 0) {
        const latest = protonResult.value[protonResult.value.length - 1];
        setProtonFlux(latest.flux);
      }

      if (xrayResult.status === 'fulfilled' && xrayResult.value.length > 0) {
        const latest = xrayResult.value[xrayResult.value.length - 1];
        const flux = latest.goes18Long ?? latest.goes19Long;
        if (flux !== null) setXrayFlux(flux);
      }
    };

    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const gScale = kp !== null ? getGScale(kp) : null;
  const sScale = protonFlux !== null ? getSScale(protonFlux) : null;
  const rScale = xrayFlux !== null ? getRScale(xrayFlux) : null;

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
        <div className={`carousel__card carousel__scale-card carousel__scale-card--${gScale?.severity ?? 'loading'}`}>
          <div className="carousel__card-header">
            <h3 className="carousel__card-title">Geomagnetic Storms</h3>
            {gScale && (
              <span className={`carousel__scale-badge carousel__scale-badge--${gScale.severity}`}>
                {gScale.level}
              </span>
            )}
          </div>
          <div className="carousel__card-value">
            {gScale ? gScale.label : '--'}
          </div>
          <div className="carousel__card-detail">
            {kp !== null ? `Kp ${kp.toFixed(2)}` : ''}
          </div>
        </div>

        <div className={`carousel__card carousel__scale-card carousel__scale-card--${sScale?.severity ?? 'loading'}`}>
          <div className="carousel__card-header">
            <h3 className="carousel__card-title">Solar Radiation</h3>
            {sScale && (
              <span className={`carousel__scale-badge carousel__scale-badge--${sScale.severity}`}>
                {sScale.level}
              </span>
            )}
          </div>
          <div className="carousel__card-value">
            {sScale ? sScale.label : '--'}
          </div>
          <div className="carousel__card-detail">
            {protonFlux !== null ? `\u226510 MeV: ${formatProtonFlux(protonFlux)}` : ''}
          </div>
        </div>

        <div className={`carousel__card carousel__scale-card carousel__scale-card--${rScale?.severity ?? 'loading'}`}>
          <div className="carousel__card-header">
            <h3 className="carousel__card-title">Radio Blackouts</h3>
            {rScale && (
              <span className={`carousel__scale-badge carousel__scale-badge--${rScale.severity}`}>
                {rScale.level}
              </span>
            )}
          </div>
          <div className="carousel__card-value">
            {rScale ? rScale.label : '--'}
          </div>
          <div className="carousel__card-detail">
            {xrayFlux !== null ? `X-Ray: ${formatXrayClass(xrayFlux)}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Carousel;
