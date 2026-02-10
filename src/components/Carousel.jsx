import { useEffect, useState } from 'react';
import { fetchKpIndex, fetchMagneticFieldData } from '../services/spaceWeather';
import { fetchFlareProbabilities } from '../services/solarActivity';
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

const Carousel = () => {
  const [kp, setKp] = useState(null);
  const [bz, setBz] = useState(null);
  const [flareLabel, setFlareLabel] = useState(null);

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

    loadBadgeData();
    const interval = setInterval(loadBadgeData, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Placeholder data for carousel cards
  const cards = [
    {
      id: 1,
      title: 'Solar Wind',
      value: '425 km/s',
      status: 'Normal',
      statusType: 'normal',
    },
    {
      id: 2,
      title: 'Kp Index',
      value: '2.67',
      status: 'Quiet',
      statusType: 'quiet',
    },
    {
      id: 3,
      title: 'Proton Flux',
      value: '1.2 pfu',
      status: 'Low',
      statusType: 'normal',
    },
    {
      id: 4,
      title: 'X-Ray Flux',
      value: 'C1.2',
      status: 'Background',
      statusType: 'normal',
    },
    {
      id: 5,
      title: 'Magnetogram',
      value: 'Active',
      status: '3 Regions',
      statusType: 'watch',
    },
  ];

  return (
    <div className="carousel">
      <div className="carousel__header">
        <div className="carousel__badges">
          <span className="carousel__metric carousel__metric--kp">
            {kp !== null ? `KP: ${Math.round(kp)} · ${getKpLabel(kp)}` : 'KP: --'}
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
        {cards.map(card => (
          <div key={card.id} className="carousel__card">
            <div className="carousel__card-header">
              <h3 className="carousel__card-title">{card.title}</h3>
              <span className={`carousel__card-badge carousel__card-badge--${card.statusType}`}>
                {card.status}
              </span>
            </div>
            <div className="carousel__card-value">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Carousel;
