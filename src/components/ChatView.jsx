import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatMessage } from './ChatMessage'
import { TypingIndicator } from './TypingIndicator'

const TEXTAREA_MAX_HEIGHT = 160

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const SUGGESTIONS = [
  '3-day trip from Manado to Bali, love beaches',
  'Weekend in Singapore for street food',
  '5 days in Tokyo, museum-heavy itinerary',
]

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
        Some details were missing from your message. Please complete them.
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
        {disabled ? 'Working…' : 'Continue planning'}
      </button>
    </form>
  )
}

export function ChatView({ chat, savedPlanKeys }) {
  const {
    pathMessages,
    allMessages,
    streaming,
    pendingTrip,
    status,
    error,
    busy,
    sendMessage,
    confirmPendingTrip,
    selectPlanForRefine,
    editMessage,
    regenerateAssistant,
    switchBranch,
    savePlan,
    stop,
  } = chat

  const [text, setText] = useState('')
  const textareaRef = useRef(null)
  const scrollerRef = useRef(null)

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [pathMessages, streaming?.content])

  const handleChange = (e) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px'
  }

  const submit = (override) => {
    const value = (override ?? text).trim()
    if (!value || busy) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    sendMessage(value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const isEmpty = pathMessages.length === 0 && !pendingTrip && !streaming

  const savedKeysForThisSession = useMemo(() => savedPlanKeys ?? new Set(), [savedPlanKeys])

  return (
    <div className="chat-surface">
      <div className="chat-scroller" ref={scrollerRef}>
        {isEmpty && (
          <div className="chat-empty">
            <h2 className="chat-empty__title">Plan a trip with AI</h2>
            <p className="chat-empty__sub">Describe your trip and I'll search real flights, hotels, and places, then suggest 3 plans.</p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" disabled={busy} onClick={() => submit(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {pathMessages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            allMessages={allMessages}
            isStreaming={false}
            onEdit={editMessage}
            onRegenerate={regenerateAssistant}
            onSwitchBranch={switchBranch}
            onSelectPlan={selectPlanForRefine}
            onSavePlan={async () => {
              const saved = await savePlan()
              if (saved && savedKeysForThisSession.add) savedKeysForThisSession.add(saved.plan_key)
            }}
            isSavedHere={m.state_snapshot?.selected_plan && savedKeysForThisSession.has(`${m.session_id}::${m.state_snapshot.selected_plan.title}::${m.state_snapshot.selected_plan.total_price}`)}
            disabled={busy}
          />
        ))}

        {streaming && (
          <ChatMessage
            message={{ id: streaming.tempId, role: 'assistant', content: '', plan_snapshot: null, state_snapshot: null, parent_id: null }}
            allMessages={allMessages}
            isStreaming
            streamingContent={streaming.content}
            onEdit={() => {}}
            onRegenerate={() => {}}
            onSwitchBranch={() => {}}
            onSelectPlan={() => {}}
            onSavePlan={() => {}}
            isSavedHere={false}
            disabled
          />
        )}

        {busy && !streaming && (
          <TypingIndicator label={status || 'Working…'} />
        )}

        {error && (
          <div className="error-box"><strong>Error:</strong> {error}</div>
        )}

        {pendingTrip && (
          <ConfirmForm pendingTrip={pendingTrip} onConfirm={confirmPendingTrip} disabled={busy} />
        )}
      </div>

      <form
        className="chat-composer"
        onSubmit={(e) => { e.preventDefault(); submit() }}
      >
        <textarea
          ref={textareaRef}
          className="chat-composer__input"
          placeholder={pathMessages.length ? 'Reply to refine the plan…' : 'Describe your trip…'}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={busy && !streaming}
        />
        {busy ? (
          <button type="button" className="chat-composer__stop" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="chat-composer__send" disabled={!text.trim()}>Send</button>
        )}
      </form>
    </div>
  )
}
