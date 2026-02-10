import './SolarActivity.css';

const SolarActivity = () => (
  <section className="solar-activity">
    <header className="solar-activity__header">
      <h2 className="solar-activity__title">Solar Activity</h2>
    </header>

    <div className="panel solar-activity__placeholder">Flare probabilities loading.</div>
    <div className="panel solar-activity__placeholder">Solar imagery loading.</div>
    <div className="panel solar-activity__placeholder">X-Ray activity loading.</div>
    <div className="panel solar-activity__placeholder">Recent flares loading.</div>
    <div className="panel solar-activity__placeholder">Particle environment loading.</div>
  </section>
);

export default SolarActivity;
