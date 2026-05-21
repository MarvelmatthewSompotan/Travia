import './SuggestionCards.css'

const ICONS = {
  flight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11h18l-2 8H5l-2-8z" />
      <path d="M12 11V4" />
      <path d="M9 4h6" />
    </svg>
  ),
  museum: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V10l7-5 7 5v11" />
      <path d="M9 21v-7M15 21v-7M12 21v-7" />
    </svg>
  ),
}

export function SuggestionCards({ items, onPick, disabled }) {
  return (
    <div className="suggestions">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={`suggestion suggestion--${item.tone || 'a'}`}
          disabled={disabled}
          onClick={() => onPick(item.prompt)}
        >
          <span className="suggestion__icon">{ICONS[item.icon] || ICONS.flight}</span>
          <h4 className="suggestion__title">{item.title}</h4>
          <p className="suggestion__desc">{item.description}</p>
        </button>
      ))}
    </div>
  )
}
