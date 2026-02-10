import { useState } from 'react'
import './App.css'
import SolarHero from './components/SolarHero'
import Carousel from './components/Carousel'
import SpaceWeather from './components/SpaceWeather'

function App() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">HELIOFLUX</h1>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'home' && (
          <>
            <section className="hero-section">
              <SolarHero />
            </section>
            <Carousel />
          </>
        )}
        {activeTab === 'space-weather' && <SpaceWeather />}
        {activeTab === 'solar-activity' && (
          <div className="panel">Solar Activity tracking is coming soon.</div>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        <button
          className={activeTab === 'home' ? 'nav-item is-active' : 'nav-item'}
          type="button"
          aria-current={activeTab === 'home' ? 'page' : undefined}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          className={
            activeTab === 'space-weather' ? 'nav-item is-active' : 'nav-item'
          }
          type="button"
          aria-current={activeTab === 'space-weather' ? 'page' : undefined}
          onClick={() => setActiveTab('space-weather')}
        >
          Space Weather
        </button>
        <button
          className={
            activeTab === 'solar-activity' ? 'nav-item is-active' : 'nav-item'
          }
          type="button"
          aria-current={activeTab === 'solar-activity' ? 'page' : undefined}
          onClick={() => setActiveTab('solar-activity')}
        >
          Solar Activity
        </button>
      </nav>
    </div>
  )
}

export default App
