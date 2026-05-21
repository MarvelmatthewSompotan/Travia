import { useState } from 'react'
import './PreviousChats.css'

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export function PreviousChats({ sessions, activeId, onPick, onDelete, onNewChat }) {
  const [open, setOpen] = useState(true)

  return (
    <div className={`prev-chats${open ? ' prev-chats--open' : ''}`}>
      <button
        type="button"
        className="prev-chats__toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <svg className={`prev-chats__caret${open ? ' prev-chats__caret--open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>Recent</span>
        {sessions.length > 0 && <span className="prev-chats__count">{sessions.length}</span>}
      </button>

      {open && (
        <div className="prev-chats__body">
          <button type="button" className="prev-chats__new" onClick={onNewChat}>
            + New chat
          </button>
          {sessions.length === 0 ? (
            <p className="prev-chats__empty">No chats yet.</p>
          ) : (
            <ul className="prev-chats__list">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={`prev-chats__item${activeId === s.id ? ' prev-chats__item--active' : ''}`}
                >
                  <button
                    type="button"
                    className="prev-chats__item-main"
                    onClick={() => onPick(s.id)}
                  >
                    <span className="prev-chats__title">{s.title || 'Untitled chat'}</span>
                    <span className="prev-chats__time">{formatRelative(s.updated_at)}</span>
                  </button>
                  <button
                    type="button"
                    className="prev-chats__del"
                    aria-label="Delete chat"
                    onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
