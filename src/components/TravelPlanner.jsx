import { useState, useRef } from 'react'
import { useTrip } from '../hooks/useTrip'
import { PlanCard } from './PlanCard'
import { PlanDetail } from './PlanDetail'
import { TypingIndicator } from './TypingIndicator'
import { planKeyFor } from '../lib/planKey'

const PLAN_ICONS = ['🏆', '💰', '⚖️']

const SUGGESTIONS = [
  '3-day trip from Manado to Bali, love beaches',
  'Weekend in Singapore for street food',
  '5 days in Tokyo, museum-heavy itinerary',
]

const TEXTAREA_MAX_HEIGHT = 160

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function ConfirmForm({ pendingTrip, onConfirm, disabled }) {
  const { info } = pendingTrip
  const [fields, setFields] = useState({
    departure_iata: info.departure_iata || '',
    departure_city: info.departure_city || '',
    arrival_iata: info.arrival_iata || '',
    destination_name: info.destination_name || '',
    trip_duration_days: info.trip_duration_days || '',
    outbound_date: info.outbound_date || tomorrow(),
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFields((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm({
      ...info,
      ...fields,
      departure_iata: fields.departure_iata.toUpperCase(),
      arrival_iata: fields.arrival_iata.toUpperCase(),
      trip_duration_days: Number(fields.trip_duration_days),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="planner-form">
      <p className="confirm-note">
        Some details were missing from your prompt. Please complete them to continue.
      </p>

      <div className="row">
        <div className="field">
          <label htmlFor="departure_iata">Departure airport (IATA)</label>
          <input id="departure_iata" name="departure_iata" placeholder="e.g. MDC" value={fields.departure_iata} onChange={handleChange} maxLength={4} required />
        </div>
        <div className="field">
          <label htmlFor="arrival_iata">Arrival airport (IATA)</label>
          <input id="arrival_iata" name="arrival_iata" placeholder="e.g. HND" value={fields.arrival_iata} onChange={handleChange} maxLength={4} required />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="destination_name">Destination</label>
          <input id="destination_name" name="destination_name" placeholder="e.g. Tokyo, Japan" value={fields.destination_name} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="trip_duration_days">Trip length (days)</label>
          <input id="trip_duration_days" name="trip_duration_days" type="number" min={1} placeholder="e.g. 2" value={fields.trip_duration_days} onChange={handleChange} required />
        </div>
        <div className="field">
          <label htmlFor="outbound_date">Departure date</label>
          <input id="outbound_date" name="outbound_date" type="date" value={fields.outbound_date} onChange={handleChange} required />
        </div>
      </div>

      <button type="submit" disabled={disabled} className="search-btn">
        {disabled ? 'Working…' : 'Search & generate plans'}
      </button>
    </form>
  )
}

export function TravelPlanner({ savedKeys, onSavePlan }) {
  const [prompt, setPrompt] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(null)
  const textareaRef = useRef(null)
  const { plans, loading, status, error, pendingTrip, analyze, confirmTrip } = useTrip()

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const submitPrompt = (text) => {
    const value = (text ?? prompt).trim()
    if (!value || loading) return
    setSelectedIndex(null)
    analyze(value)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submitPrompt()
  }

  const handleChipClick = (text) => {
    setPrompt(text)
    submitPrompt(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitPrompt()
    }
  }

  const handlePromptChange = (e) => {
    setPrompt(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px'
  }

  if (selectedIndex !== null && plans) {
    const section = plans[selectedIndex]
    const key = planKeyFor(section)
    const isSaved = savedKeys?.has(key) ?? false
    return (
      <PlanDetail
        section={section}
        onBack={() => setSelectedIndex(null)}
        onSave={() => onSavePlan?.(section)}
        isSaved={isSaved}
      />
    )
  }

  const showChips = !pendingTrip && !plans && !loading

  return (
    <div>
      {pendingTrip ? (
        <ConfirmForm pendingTrip={pendingTrip} onConfirm={confirmTrip} disabled={loading} />
      ) : (
        <form onSubmit={handleSubmit} className="planner-form">
          <div className="field">
            <label htmlFor="trip-prompt">Describe your trip</label>
            <textarea
              ref={textareaRef}
              id="trip-prompt"
              placeholder="e.g. I want a 2-day trip from Manado to Tokyo, I love local sightseeing."
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              rows={1}
              required
            />
          </div>

          {showChips && (
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => handleChipClick(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <button type="submit" disabled={loading} className="search-btn">
            {loading ? (status || 'Working…') : 'Generate 3 plans'}
          </button>
        </form>
      )}

      {loading && (
        <>
          <TypingIndicator label={status || 'Generating plans'} />
          <div className="plan-cards">
            {[0, 1, 2].map((i) => (
              <div key={i} className="plan-card plan-card--skeleton" />
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      )}

      {plans && !loading && (
        <div className="plan-cards">
          {plans.map((plan, i) => (
            <PlanCard
              key={i}
              icon={PLAN_ICONS[i]}
              title={plan.title}
              brief={plan.brief}
              price={plan.total_price}
              onClick={() => {
                setSelectedIndex(i)
                resetTextareaHeight()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
