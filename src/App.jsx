import { useState, useEffect, useMemo } from 'react'
import { TravelPlanner } from './components/TravelPlanner'
import { MyPlans } from './components/MyPlans'
import { Toast } from './components/Toast'
import { planKeyFor } from './lib/planKey'
import './App.css'

const TODAY = new Date().toISOString().split('T')[0]
const STORAGE_KEY = 'rag-gfs:saved-plans'

const HEADER_LABELS = {
  planner: 'AI Travel Planner',
  flights: 'Flight Search',
  plans: 'My Plans',
}

function NavIcon({ name }) {
  if (name === 'planner') {
    return (
      <svg className="app-shell__nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
      </svg>
    )
  }
  if (name === 'flights') {
    return (
      <svg className="app-shell__nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      </svg>
    )
  }
  return (
    <svg className="app-shell__nav-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('planner')
  const [toast, setToast] = useState(null)

  const [savedPlans, setSavedPlans] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlans))
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [savedPlans])

  const savedKeys = useMemo(
    () => new Set(savedPlans.map((sp) => planKeyFor(sp.plan))),
    [savedPlans],
  )

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSavePlan = (plan) => {
    const key = planKeyFor(plan)
    if (savedKeys.has(key)) return
    const entry = { id: `${key}-${Date.now()}`, plan, savedAt: new Date().toISOString() }
    setSavedPlans((prev) => [entry, ...prev])
    showToast(`Saved “${plan.title}” to My Plans`)
  }

  const [form, setForm] = useState({
    departure_id: '',
    arrival_id: '',
    outbound_date: TODAY,
    return_date: '',
    flight_type: 'one_way',
    currency: 'USD',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: form.departure_id.toUpperCase(),
      arrival_id: form.arrival_id.toUpperCase(),
      outbound_date: form.outbound_date,
      flight_type: form.flight_type,
      currency: form.currency,
    })

    if (form.flight_type === 'round_trip' && form.return_date) {
      params.set('return_date', form.return_date)
    }

    params.set('api_key', import.meta.env.VITE_SEARCHAPI_KEY)

    try {
      const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body}`)
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const navItem = (id, label, extra) => (
    <button
      key={id}
      className={`app-shell__nav-item${activeTab === id ? ' app-shell__nav-item--active' : ''}`}
      onClick={() => setActiveTab(id)}
      type="button"
    >
      <NavIcon name={id} />
      <span>{label}</span>
      {extra}
    </button>
  )

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__logo">
          <span className="app-shell__brand-mark">R</span>
          <span>
            <span className="app-shell__brand">RAG GFS</span>
            <span className="app-shell__brand-sub">AI-powered travel</span>
          </span>
        </div>

        <nav className="app-shell__nav">
          {navItem('planner', 'AI Travel Planner')}
          {navItem('flights', 'Flight Search')}
          {navItem(
            'plans',
            'My Plans',
            savedPlans.length > 0 && (
              <span className="app-shell__nav-count">{savedPlans.length}</span>
            ),
          )}
        </nav>

        <div className="app-shell__footer">Local Ollama · SearchAPI</div>
      </aside>

      <main className="app-shell__main">
        <header className="app-shell__header">
          <span className="status-dot" />
          <span>{HEADER_LABELS[activeTab]}</span>
          <span className="app-shell__header-status">Ready</span>
        </header>

        <div className="container">
          {activeTab === 'planner' && (
            <TravelPlanner savedKeys={savedKeys} onSavePlan={handleSavePlan} />
          )}

          {activeTab === 'plans' && (
            <MyPlans
              savedPlans={savedPlans}
              onSwitchToPlanner={() => setActiveTab('planner')}
            />
          )}

          {activeTab === 'flights' && (
            <>
              <form onSubmit={handleSearch} className="search-form">
                <div className="row">
                  <div className="field">
                    <label htmlFor="departure_id">Departure</label>
                    <input
                      id="departure_id"
                      name="departure_id"
                      placeholder="e.g. JFK"
                      value={form.departure_id}
                      onChange={handleChange}
                      maxLength={4}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="arrival_id">Arrival</label>
                    <input
                      id="arrival_id"
                      name="arrival_id"
                      placeholder="e.g. LAX"
                      value={form.arrival_id}
                      onChange={handleChange}
                      maxLength={4}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="flight_type">Trip type</label>
                    <select id="flight_type" name="flight_type" value={form.flight_type} onChange={handleChange}>
                      <option value="one_way">One-way</option>
                      <option value="round_trip">Round-trip</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="currency">Currency</label>
                    <select id="currency" name="currency" value={form.currency} onChange={handleChange}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="IDR">IDR</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  <div className="field">
                    <label htmlFor="outbound_date">Departure date</label>
                    <input
                      id="outbound_date"
                      name="outbound_date"
                      type="date"
                      value={form.outbound_date}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  {form.flight_type === 'round_trip' && (
                    <div className="field">
                      <label htmlFor="return_date">Return date</label>
                      <input
                        id="return_date"
                        name="return_date"
                        type="date"
                        value={form.return_date}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="search-btn">
                  {loading ? 'Searching…' : 'Search flights'}
                </button>
              </form>

              {error && (
                <div className="error-box">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {result && (
                <div className="result-box">
                  <div className="result-header">
                    <span>JSON Response</span>
                    <button
                      className="copy-btn"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                    >
                      Copy
                    </button>
                  </div>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Toast message={toast} />
    </div>
  )
}

export default App
