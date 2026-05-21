import { useState } from 'react'
import './ConfirmForm.css'

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function ConfirmForm({ pendingTrip, onConfirm, disabled }) {
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
    <form onSubmit={handleSubmit} className="confirm-form">
      <p className="confirm-form__note">
        Some details were missing — fill them in to continue.
      </p>
      <div className="confirm-form__row">
        <div className="confirm-form__field">
          <label htmlFor="departure_iata">Departure airport (IATA)</label>
          <input id="departure_iata" name="departure_iata" placeholder="e.g. MDC" value={fields.departure_iata} onChange={handleChange} maxLength={4} required />
        </div>
        <div className="confirm-form__field">
          <label htmlFor="arrival_iata">Arrival airport (IATA)</label>
          <input id="arrival_iata" name="arrival_iata" placeholder="e.g. HND" value={fields.arrival_iata} onChange={handleChange} maxLength={4} required />
        </div>
      </div>
      <div className="confirm-form__row">
        <div className="confirm-form__field">
          <label htmlFor="destination_name">Destination</label>
          <input id="destination_name" name="destination_name" placeholder="e.g. Tokyo, Japan" value={fields.destination_name} onChange={handleChange} required />
        </div>
        <div className="confirm-form__field">
          <label htmlFor="trip_duration_days">Trip length (days)</label>
          <input id="trip_duration_days" name="trip_duration_days" type="number" min={1} placeholder="e.g. 2" value={fields.trip_duration_days} onChange={handleChange} required />
        </div>
        <div className="confirm-form__field">
          <label htmlFor="outbound_date">Departure date</label>
          <input id="outbound_date" name="outbound_date" type="date" value={fields.outbound_date} onChange={handleChange} required />
        </div>
      </div>
      <button type="submit" disabled={disabled} className="confirm-form__submit">
        {disabled ? 'Working…' : 'Continue planning'}
      </button>
    </form>
  )
}
