import './SidebarMenu.css'

function NavIcon({ name }) {
  if (name === 'planner') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12 12 4l9 8" />
        <path d="M5 10v9h14v-9" />
      </svg>
    )
  }
  if (name === 'flights') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16" />
    </svg>
  )
}

export function SidebarMenu({ activeTab, onTabChange, items }) {
  return (
    <nav className="sidebar-menu">
      {items.map((item) => (
        <button
          key={item.id}
          className={`sidebar-menu__item${activeTab === item.id ? ' sidebar-menu__item--active' : ''}`}
          onClick={() => onTabChange(item.id)}
          type="button"
        >
          <NavIcon name={item.id} />
          <span className="sidebar-menu__label">{item.label}</span>
          {item.count > 0 && <span className="sidebar-menu__count">{item.count}</span>}
        </button>
      ))}
    </nav>
  )
}
