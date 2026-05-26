import { useMemo, useState } from 'react'
import { AppShell } from './components/Layout/AppShell/AppShell'
import { SidebarMenu } from './components/Molecules/SidebarMenu/SidebarMenu'
import { PreviousChats } from './components/Molecules/PreviousChats/PreviousChats'
import { Toast } from './components/Atoms/Toast/Toast'
import { Planner } from './components/Pages/Planner/Planner'
import { MyPlans } from './components/Pages/MyPlans/MyPlans'
import LoginPage from './components/Pages/LoginPage/LoginPage'
import RegisterPage from './components/Pages/RegisterPage/RegisterPage'
import { useChat, useSavedPlans, useSessionsList } from './hooks/useChat'
import { useAuth } from './hooks/useAuth'

const NAV_ITEMS = [
  { id: 'planner', label: 'AI Travel Planner' },
  { id: 'plans',   label: 'My Plans' },
]

function AuthedApp({ auth }) {
  const [activeTab, setActiveTab] = useState('planner')
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const chat = useChat()
  const { sessions } = useSessionsList(chat.refreshNonce)
  const { plans: savedPlans, reload: reloadPlans, deletePlan } = useSavedPlans(chat.refreshNonce)

  const savedPlanKeys = useMemo(
    () => new Set(savedPlans.map((p) => p.plan_key)),
    [savedPlans],
  )

  const handleSavePlan = async () => {
    const saved = await chat.savePlan()
    if (saved) {
      await reloadPlans()
      showToast(`Saved "${saved.title}" to My Plans`)
    }
  }

  const handlePickSession = async (id) => {
    setActiveTab('planner')
    await chat.loadSession(id)
  }

  const handleNewChat = () => {
    setActiveTab('planner')
    chat.newSession()
  }

  const handleLogout = async () => {
    await auth.logout()
  }

  const items = NAV_ITEMS.map((item) =>
    item.id === 'plans' ? { ...item, count: savedPlans.length } : item,
  )

  const sidebarMain = (
    <>
      <SidebarMenu activeTab={activeTab} onTabChange={setActiveTab} items={items} />
      <PreviousChats
        sessions={sessions}
        activeId={chat.sessionId}
        onPick={handlePickSession}
        onDelete={chat.deleteSession}
        onNewChat={handleNewChat}
      />
    </>
  )

  return (
    <AppShell sidebarMain={sidebarMain} user={auth.user} onLogout={handleLogout}>
      {activeTab === 'planner' && (
        <Planner
          chat={chat}
          savedPlanKeys={savedPlanKeys}
          onSavePlan={handleSavePlan}
        />
      )}
      {activeTab === 'plans' && (
        <MyPlans
          savedPlans={savedPlans}
          onSwitchToPlanner={() => setActiveTab('planner')}
          onDelete={deletePlan}
        />
      )}
      <Toast message={toast} />
    </AppShell>
  )
}

function App() {
  const auth = useAuth()
  const [authView, setAuthView] = useState('login')

  if (!auth.isAuthenticated) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={auth.register}
          onGoLogin={() => setAuthView('login')}
        />
      )
    }
    return (
      <LoginPage
        onLogin={auth.login}
        onGoRegister={() => setAuthView('register')}
      />
    )
  }

  return <AuthedApp auth={auth} />
}

export default App
