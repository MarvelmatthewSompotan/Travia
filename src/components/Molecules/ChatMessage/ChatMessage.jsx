import { useState } from 'react'
import { formatBold } from '../../../services/formatBold'
import { siblingInfo } from '../../../services/chatTree'
import { PlanCard } from '../PlanCard/PlanCard'
import { PlanDetail } from '../PlanDetail/PlanDetail'
import suitcaseIcon from '../../../assets/icons/u_suitcase-alt.svg'
import './ChatMessage.css'

function BranchArrows({ message, allMessages, onSwitchBranch }) {
  const { siblings, indexInSiblings } = siblingInfo(allMessages, message)
  if (siblings.length <= 1) return null
  const goPrev = () => {
    const idx = (indexInSiblings - 1 + siblings.length) % siblings.length
    onSwitchBranch(siblings[idx].id)
  }
  const goNext = () => {
    const idx = (indexInSiblings + 1) % siblings.length
    onSwitchBranch(siblings[idx].id)
  }
  return (
    <span className="chat-branch-arrows">
      <button type="button" className="chat-branch-arrow" onClick={goPrev} aria-label="Previous branch">‹</button>
      <span className="chat-branch-count">{indexInSiblings + 1} / {siblings.length}</span>
      <button type="button" className="chat-branch-arrow" onClick={goNext} aria-label="Next branch">›</button>
    </span>
  )
}

function UserMessage({ message, allMessages, onEdit, onSwitchBranch, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  if (editing) {
    return (
      <div className="chat-message chat-message--user chat-message--editing">
        <textarea
          className="chat-message__editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          autoFocus
        />
        <div className="chat-message__editor-actions">
          <button type="button" className="chat-action" onClick={() => { setEditing(false); setDraft(message.content) }}>Cancel</button>
          <button
            type="button"
            className="chat-action chat-action--primary"
            disabled={disabled || !draft.trim() || draft.trim() === message.content.trim()}
            onClick={() => { setEditing(false); onEdit(message.id, draft.trim()) }}
          >Save & resend</button>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-message chat-message--user">
      <div className="chat-message__bubble">{message.content}</div>
      <div className="chat-message__tools">
        <BranchArrows message={message} allMessages={allMessages} onSwitchBranch={onSwitchBranch} />
        <button type="button" className="chat-action" disabled={disabled} onClick={() => setEditing(true)}>Edit</button>
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  allMessages,
  isStreaming,
  streamingContent,
  onRegenerate,
  onSwitchBranch,
  onSavePlan,
  isSavedHere,
  disabled,
}) {
  const [openPlanIndex, setOpenPlanIndex] = useState(null)
  const plans = message.plan_snapshot || []
  const hasPlan = plans.length >= 1 && message.state_snapshot?.current_plan
  const content = isStreaming ? streamingContent : message.content

  if (openPlanIndex != null && plans[openPlanIndex]) {
    return (
      <PlanDetail
        section={plans[openPlanIndex]}
        onBack={() => setOpenPlanIndex(null)}
        onSave={onSavePlan}
        isSaved={isSavedHere}
      />
    )
  }

  return (
    <div className={`chat-message chat-message--assistant${isStreaming ? ' chat-message--streaming' : ''}`}>
      <div className="chat-message__bubble">
        {content ? formatBold(content) : <span className="chat-message__placeholder">…</span>}
      </div>

      {hasPlan && (
        <div className="chat-plans">
          <div className="chat-plan-row">
            <PlanCard
              icon={<img src={suitcaseIcon} alt="" aria-hidden="true" className="plan-card__icon-img" />}
              tone="a"
              title={plans[0].title}
              brief={plans[0].brief}
              price={plans[0].total_price}
              onClick={() => setOpenPlanIndex(0)}
            />
            <button
              type="button"
              className={`chat-action${isSavedHere ? '' : ' chat-action--primary'}`}
              disabled={isSavedHere || disabled}
              onClick={onSavePlan}
            >{isSavedHere ? 'Saved' : 'Save plan'}</button>
          </div>
        </div>
      )}

      {!isStreaming && (
        <div className="chat-message__tools">
          <BranchArrows message={message} allMessages={allMessages} onSwitchBranch={onSwitchBranch} />
          <button type="button" className="chat-action" disabled={disabled} onClick={() => onRegenerate(message.id)}>Regenerate</button>
        </div>
      )}
    </div>
  )
}

export function ChatMessage(props) {
  return props.message.role === 'user'
    ? <UserMessage {...props} />
    : <AssistantMessage {...props} />
}
