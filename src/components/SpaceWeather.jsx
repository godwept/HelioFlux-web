import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchGoesMagnetometerData,
  fetchHemisphericPowerData,
  fetchKpIndex,
  fetchMagneticFieldData,
  fetchOvationData,
  fetchPlasmaData,
} from '../services/spaceWeather';
import AuroraGlobe from './AuroraGlobe';
import LineChart from './LineChart';
import BarChart from './BarChart';
import './SpaceWeather.css';

const TIMEFRAMES = [
  { label: 'Full (2 day)', hours: 48 },
  { label: '12 hours', hours: 12 },
  { label: '3 hours', hours: 3 },
  { label: '1 hour', hours: 1 },
];

const filterByWindow = (data, hours) => {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return data.filter(entry => entry.timestamp.valueOf() >= cutoff);
};

const getLatestValue = (data, key) => {
  const latest = [...data].reverse().find(entry => entry[key] !== 0);
  return latest ? latest[key] : 0;
};

const formatValue = (value, decimals = 1) =>
  Number.isFinite(value) ? value.toFixed(decimals) : '0.0';

const kpStatus = kp => {
  if (kp >= 9) return 'Severe';
  if (kp >= 7) return 'Strong';
  if (kp >= 6) return 'Moderate';
  if (kp >= 5) return 'Minor';
  if (kp >= 3) return 'Unsettled';
  return 'Quiet';
};

const kpColor = kp => {
  if (kp >= 9) return '#ff3b30';
  if (kp >= 7) return '#ff9500';
  if (kp >= 6) return '#ffd60a';
  if (kp >= 5) return '#ffb400';
  if (kp >= 3) return '#5ac8fa';
  return '#34c759';
};

const SpaceWeather = () => {
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[1]);
  const [magneticData, setMagneticData] = useState([]);
  const [plasmaData, setPlasmaData] = useState([]);
  const [kpData, setKpData] = useState([]);
  const [magnetometerData, setMagnetometerData] = useState([]);
  const [magnetometerLabels, setMagnetometerLabels] = useState({
    primary: 'GOES-P',
    secondary: 'GOES-S',
  });
  const [ovationData, setOvationData] = useState(null);
  const [hpData, setHpData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [magnetic, plasma, kp, magnetometer] = await Promise.all([
        fetchMagneticFieldData(),
        fetchPlasmaData(),
        fetchKpIndex(),
        fetchGoesMagnetometerData(),
      ]);
      setMagneticData(magnetic);
      setPlasmaData(plasma);
      setKpData(kp);
      setMagnetometerData(magnetometer.data);
      setMagnetometerLabels({
        primary: magnetometer.primaryLabel,
        secondary: magnetometer.secondaryLabel,
      });
    } catch (err) {
      setError(err.message ?? 'Unable to load space weather data.');
    } finally {
      setIsLoading(false);
    }

    // Load globe + HP data non-blocking — large files, separate from main charts
    try {
      const [ovation, hp] = await Promise.all([
        fetchOvationData(),
        fetchHemisphericPowerData(),
      ]);
      setOvationData(ovation);
      setHpData(hp);
    } catch (err) {
      console.warn('[HelioFlux] Globe/HP data unavailable:', err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredMagnetic = useMemo(
    () => filterByWindow(magneticData, timeframe.hours),
    [magneticData, timeframe]
  );

  const filteredPlasma = useMemo(
    () => filterByWindow(plasmaData, timeframe.hours),
    [plasmaData, timeframe]
  );

  const filteredKp = useMemo(() => filterByWindow(kpData, 48), [kpData]);

  const filteredMagnetometer = useMemo(
    () => filterByWindow(magnetometerData, timeframe.hours),
    [magnetometerData, timeframe]
  );

  const currentBz = useMemo(
    () => getLatestValue(magneticData, 'bz'),
    [magneticData]
  );
  const currentSpeed = useMemo(
    () => getLatestValue(plasmaData, 'speed'),
    [plasmaData]
  );
  const currentDensity = useMemo(
    () => getLatestValue(plasmaData, 'density'),
    [plasmaData]
  );
  const currentKp = useMemo(
    () => getLatestValue(kpData, 'kp'),
    [kpData]
  );

  return (
    <section className="space-weather">
      {/* ── Aurora Globe Hero ──────────────────────────────── */}
      <div className="space-weather__hero">
        <AuroraGlobe ovationData={ovationData} />
      </div>

      <header className="space-weather__header">
        <h2 className="space-weather__title">Solar Wind</h2>
      </header>

      <div className="space-weather__badges">
        <span className="metric-badge metric-badge--bz">
          Bz: {formatValue(currentBz)} nT
        </span>
        <span className="metric-badge metric-badge--speed">
          Speed: {formatValue(currentSpeed)} km/s
        </span>
        <span className="metric-badge metric-badge--density">
          Density: {formatValue(currentDensity)} p/cm³
        </span>
      </div>

      <div className="space-weather__timeframes">
        {TIMEFRAMES.map(frame => (
          <button
            key={frame.label}
            type="button"
            className={
              frame.label === timeframe.label
                ? 'timeframe-button is-active'
                : 'timeframe-button'
            }
            onClick={() => setTimeframe(frame)}
          >
            {frame.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="panel">Loading space weather data...</div>
      ) : error ? (
        <div className="panel">{error}</div>
      ) : (
        <>
          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>Bz/Bt (nT)</h3>
              <span>Magnetic Field</span>
            </div>
            <LineChart
              data={filteredMagnetic}
              series={[
                { key: 'bz', color: '#ff375f', label: 'Bz' },
                { key: 'bt', color: '#5ac8fa', label: 'Bt' },
              ]}
            />
          </div>

          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>Density (p/cm³)</h3>
              <span>Solar Wind</span>
            </div>
            <LineChart
              data={filteredPlasma}
              series={[{ key: 'density', color: '#ff9f0a', label: 'Density' }]}
            />
          </div>

          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>Speed (km/s)</h3>
              <span>Solar Wind</span>
            </div>
            <LineChart
              data={filteredPlasma}
              series={[{ key: 'speed', color: '#34c759', label: 'Speed' }]}
            />
          </div>

          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>Temperature (Kelvin)</h3>
              <span>Solar Wind</span>
            </div>
            <LineChart
              data={filteredPlasma}
              series={[
                { key: 'temperature', color: '#0a84ff', label: 'Temperature' },
              ]}
            />
          </div>

          <div className="panel chart-card">
            <div className="chart-card__header">
              <h3>Hp (nT)</h3>
              <span>GOES Magnetometer</span>
            </div>
            <LineChart
              data={filteredMagnetometer}
              series={[
                { key: 'hpPrimary', color: '#0a84ff', label: magnetometerLabels.primary },
                { key: 'hpSecondary', color: '#ff375f', label: magnetometerLabels.secondary },
              ]}
            />
          </div>

          <div className="space-weather__section">
            <h3 className="space-weather__section-title">Geomagnetic Activity</h3>
            <div className="panel chart-card">
              <div className="chart-card__header">
                <h3>Planetary Kp Index (3-hour)</h3>
                <span className="kp-status">{kpStatus(currentKp)}</span>
              </div>
              <BarChart data={filteredKp} colorForValue={kpColor} />
            </div>

            <div className="panel chart-card">
              <div className="chart-card__header">
                <h3>Hemispheric Power (GW)</h3>
                <span>OVATION Model &middot; Today</span>
              </div>
              <LineChart
                data={hpData}
                series={[
                  { key: 'north', color: '#5ac8fa', label: 'North' },
                  { key: 'south', color: '#bf5af2', label: 'South' },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SpaceWeather;
