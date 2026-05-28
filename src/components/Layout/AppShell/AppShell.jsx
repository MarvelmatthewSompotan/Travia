import { Logo } from '../../Atoms/Logo/Logo'
import { Avatar } from '../../Atoms/Avatar/Avatar'
import './AppShell.css'

export function AppShell({ sidebarMain, sidebarFooter, children, user, onLogout, llmProvider, onToggleLLM }) {
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?'
  const displayName = user?.name ?? 'Guest'

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <Logo />
        {sidebarMain}
        <div className="app-shell__sidebar-foot">
          <Avatar initial={initial} />
          <div className="app-shell__who">
            {displayName}
            {onToggleLLM && (
              <button
                className={`app-shell__llm-toggle ${llmProvider === 'gemini' ? 'app-shell__llm-toggle--gemini' : 'app-shell__llm-toggle--ollama'}`}
                type="button"
                onClick={onToggleLLM}
                title={`Switch to ${llmProvider === 'gemini' ? 'Ollama' : 'Gemini'}`}
              >
                {llmProvider === 'gemini' ? 'Gemini' : 'Ollama'}
              </button>
            )}
          </div>
          {onLogout && (
            <button className="app-shell__logout" type="button" onClick={onLogout} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </aside>
      <main className="app-shell__main">{children}</main>
      {sidebarFooter}
    </div>
  )
}
