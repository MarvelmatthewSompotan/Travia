import { Logo } from '../../Atoms/Logo/Logo'
import { Avatar } from '../../Atoms/Avatar/Avatar'
import './AppShell.css'

export function AppShell({ sidebarMain, sidebarFooter, children }) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <Logo />
        {sidebarMain}
        <div className="app-shell__sidebar-foot">
          <Avatar initial="M" />
          <div className="app-shell__who">
            Marvel
            <span>Local dev · Ollama 3.2</span>
          </div>
        </div>
      </aside>
      <main className="app-shell__main">{children}</main>
      {/* sidebar footer slot reserved for future expansion */}
      {sidebarFooter}
    </div>
  )
}
