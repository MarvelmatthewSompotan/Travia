import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatMessage } from '../../Molecules/ChatMessage/ChatMessage'
import { Composer } from '../../Molecules/Composer/Composer'
import { ConfirmForm } from '../../Molecules/ConfirmForm/ConfirmForm'
import { Hero } from '../../Molecules/Hero/Hero'
import { SuggestionCards } from '../../Molecules/SuggestionCards/SuggestionCards'
import { TypingIndicator } from '../../Atoms/TypingIndicator/TypingIndicator'
import './Planner.css'

const SUGGESTIONS = [
  {
    icon: 'flight',
    tone: 'a',
    title: 'Cheapest dates',
    description: 'Flexible? I\'ll scan a 30-day window for the lowest fare to your destination.',
    prompt: '3-day trip from Manado to Bali, love beaches',
  },
  {
    icon: 'food',
    tone: 'b',
    title: 'Foodie weekend',
    description: 'Quick getaway built around the best local food spots.',
    prompt: 'Weekend in Singapore for street food',
  },
  {
    icon: 'museum',
    tone: 'c',
    title: 'Plan a trip',
    description: 'Tell me your vibe and budget — I\'ll build a multi-day itinerary.',
    prompt: '5 days in Tokyo, museum-heavy itinerary',
  },
]

function planKeyFor(plan, sessionId) {
  return `${sessionId}::${plan?.title ?? ''}::${plan?.total_price ?? ''}`
}

export function Planner({ chat, savedPlanKeys, onSavePlan }) {
  const {
    pathMessages,
    allMessages,
    streaming,
    pendingTrip,
    status,
    error,
    busy,
    sessionId,
    sendMessage,
    confirmPendingTrip,
    selectPlanForRefine,
    editMessage,
    regenerateAssistant,
    switchBranch,
    stop,
  } = chat

  const [text, setText] = useState('')
  const scrollerRef = useRef(null)

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [pathMessages, streaming?.content])

  const isEmpty = pathMessages.length === 0 && !pendingTrip && !streaming
  const keys = useMemo(() => savedPlanKeys ?? new Set(), [savedPlanKeys])

  const submit = (override) => {
    const value = (override ?? text).trim()
    if (!value || busy) return
    setText('')
    sendMessage(value)
  }

  return (
    <div className="planner">
      <div className="planner__scroller" ref={scrollerRef}>
        {isEmpty && (
          <div className="planner__hero-wrap">
            <Hero
              title="Where to"
              accent="next"
              subtitle="Describe your trip and I'll search live flights, hotels and places, then build a detailed plan tailored to your style."
            />
          </div>
        )}

        {!isEmpty && (
          <div className="planner__messages">
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
                onSavePlan={onSavePlan}
                isSavedHere={
                  m.state_snapshot?.selected_plan
                    ? keys.has(planKeyFor(m.state_snapshot.selected_plan, sessionId))
                    : false
                }
                disabled={busy}
              />
            ))}

            {streaming && (
              <ChatMessage
                message={{
                  id: streaming.tempId,
                  role: 'assistant',
                  content: '',
                  plan_snapshot: null,
                  state_snapshot: null,
                  parent_id: null,
                }}
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

            {busy && !streaming && <TypingIndicator label={status || 'Working…'} />}

            {pendingTrip && (
              <ConfirmForm pendingTrip={pendingTrip} onConfirm={confirmPendingTrip} disabled={busy} />
            )}
          </div>
        )}

        {error && (
          <div className="planner__error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isEmpty && (
          <SuggestionCards items={SUGGESTIONS} onPick={submit} disabled={busy} />
        )}
      </div>

      <div className="planner__composer-wrap">
        <Composer
          value={text}
          onChange={setText}
          onSubmit={submit}
          onStop={busy ? stop : undefined}
          busy={busy}
          placeholder={pathMessages.length ? 'Reply to refine the plan…' : "Find me a flight from Manado to Tokyo next month, under $600, with one stop max…"}
        />
      </div>
    </div>
  )
}
