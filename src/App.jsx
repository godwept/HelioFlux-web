import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">HelioFlux</p>
          <h1>Solar Weather Dashboard</h1>
          <p className="subtitle">
            Real-time solar imagery, space weather, and activity alerts in one
            mobile-first experience.
          </p>
        </div>
        <button className="primary-button" type="button">
          Launch overview
        </button>
      </header>

      <main className="app-main">
        <section className="panel">
          <div className="panel-header">
            <h2>Solar Imagery</h2>
            <span className="status-badge">Live</span>
          </div>
          <p>Animated solar frames and coronagraph imagery will appear here.</p>
          <div className="panel-placeholder">Hero animation placeholder</div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Space Weather</h2>
            <span className="status-badge muted">Calm</span>
          </div>
          <p>Solar wind metrics, magnetic field charts, and Kp index cards.</p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Solar Activity</h2>
            <span className="status-badge alert">Watch</span>
          </div>
          <p>Flare detection, X-ray flux monitoring, and probability outlooks.</p>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        <button className="nav-item is-active" type="button" aria-current="page">
          Home
        </button>
        <button className="nav-item" type="button">
          Space Weather
        </button>
        <button className="nav-item" type="button">
          Solar Activity
        </button>
      </nav>
    </div>
  )
}

export default App
