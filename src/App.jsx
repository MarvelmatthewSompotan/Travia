import { useMemo, useState } from 'react'
import { AppShell } from './components/Layout/AppShell/AppShell'
import { SidebarMenu } from './components/Molecules/SidebarMenu/SidebarMenu'
import { PreviousChats } from './components/Molecules/PreviousChats/PreviousChats'
import { Toast } from './components/Atoms/Toast/Toast'
import { Planner } from './components/Pages/Planner/Planner'
import { MyPlans } from './components/Pages/MyPlans/MyPlans'
import { useChat, useSavedPlans, useSessionsList } from './hooks/useChat'

const NAV_ITEMS = [
  { id: 'planner', label: 'AI Travel Planner' },
  { id: 'plans',   label: 'My Plans' },
]

function App() {
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
      showToast(`Saved “${saved.title}” to My Plans`)
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
    <AppShell sidebarMain={sidebarMain}>
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

export default App
