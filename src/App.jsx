import { useState } from 'react'
import './App.css'

const TODAY = new Date().toISOString().split('T')[0]

function App() {
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

  return (
    <div className="container">
      <header>
        <h1>Flight Search RAG</h1>
        <p>test prototype</p>
      </header>

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
    </div>
  )
}

export default App
