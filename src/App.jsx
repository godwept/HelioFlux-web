import { useEffect, useState } from 'react'
import './App.css'
import SolarHero from './components/SolarHero'
import Carousel from './components/Carousel'
import SpaceWeather from './components/SpaceWeather'

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const storedTab = sessionStorage.getItem('helioflux-active-tab')
    return storedTab ?? 'home'
  })

  useEffect(() => {
    sessionStorage.setItem('helioflux-active-tab', activeTab)
  }, [activeTab])

  return (
    <div className="app">
      <main className="app-main">
        {activeTab === 'home' && (
          <>
            <header className="home-title">HELIOFLUX</header>
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
