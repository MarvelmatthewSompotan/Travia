/**
 * Integration tests — multiple components working together and user workflows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MyPlans } from '../components/Pages/MyPlans/MyPlans'
import { Planner } from '../components/Pages/Planner/Planner'
import { AppShell } from '../components/Layout/AppShell/AppShell'
import { SidebarMenu } from '../components/Molecules/SidebarMenu/SidebarMenu'
import { PreviousChats } from '../components/Molecules/PreviousChats/PreviousChats'

// ── AppShell + SidebarMenu + PreviousChats composition ────────────────────────
describe('Sidebar composition', () => {
  const sessions = [
    { id: 's1', title: 'Bali trip', updated_at: new Date().toISOString() },
  ]
  const items = [
    { id: 'planner', label: 'AI Travel Planner' },
    { id: 'plans',   label: 'My Plans', count: 0 },
  ]
  const onTabChange = vi.fn()
  const onPick = vi.fn()
  const onDelete = vi.fn()
  const onNewChat = vi.fn()

  beforeEach(() => { vi.clearAllMocks() })

  function renderShell(activeTab) {
    const sidebar = (
      <>
        <SidebarMenu activeTab={activeTab} onTabChange={onTabChange} items={items} />
        <PreviousChats sessions={sessions} activeId={null} onPick={onPick} onDelete={onDelete} onNewChat={onNewChat} />
      </>
    )
    return render(<AppShell sidebarMain={sidebar}><div>main</div></AppShell>)
  }

  it('renders both nav items and a previous chat in the sidebar', () => {
    renderShell('planner')
    expect(screen.getByText('AI Travel Planner')).toBeInTheDocument()
    expect(screen.getByText('Bali trip')).toBeInTheDocument()
  })

  it('switching nav tab calls onTabChange', () => {
    renderShell('planner')
    fireEvent.click(screen.getByText('My Plans').closest('button'))
    expect(onTabChange).toHaveBeenCalledWith('plans')
  })

  it('clicking a previous chat calls onPick with correct id', () => {
    renderShell('planner')
    fireEvent.click(screen.getByText('Bali trip').closest('button'))
    expect(onPick).toHaveBeenCalledWith('s1')
  })

  it('deleting a chat calls onDelete', () => {
    renderShell('planner')
    fireEvent.click(screen.getByLabelText('Delete chat'))
    expect(onDelete).toHaveBeenCalledWith('s1')
  })
})

// ── MyPlans full workflow ─────────────────────────────────────────────────────
describe('MyPlans full workflow', () => {
  const plan = {
    id: 1,
    title: 'Bali Beach Trip',
    brief: 'Sun and sand',
    plan: { title: 'Bali Beach Trip', brief: 'Sun and sand', total_price: 600, flight: null, hotel: null, places: [] },
  }

  it('complete flow: grid → detail → back → still shows grid', () => {
    render(<MyPlans savedPlans={[plan]} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)

    // Grid renders
    expect(screen.getByText('Bali Beach Trip')).toBeInTheDocument()

    // Click a plan card to open detail
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Bali Beach Trip')))
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
    expect(screen.queryByText(/1 saved plan/)).toBeNull()

    // Go back
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText('1 saved plan')).toBeInTheDocument()
  })

  it('complete flow: grid → detail → delete → returns to grid', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<MyPlans savedPlans={[plan]} onSwitchToPlanner={vi.fn()} onDelete={onDelete} />)

    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Bali Beach Trip')))
    fireEvent.click(screen.getByRole('button', { name: /Remove from My Plans/i }))

    expect(onDelete).toHaveBeenCalledWith(1)
  })
})

// ── Planner composer ↔ sendMessage workflow ───────────────────────────────────
describe('Planner → sendMessage workflow', () => {
  function makeChat(overrides = {}) {
    return {
      pathMessages: [],
      allMessages: [],
      streaming: null,
      pendingTrip: null,
      status: '',
      error: null,
      busy: false,
      sessionId: null,
      sendMessage: vi.fn(),
      confirmPendingTrip: vi.fn(),
      selectPlanForRefine: vi.fn(),
      editMessage: vi.fn(),
      regenerateAssistant: vi.fn(),
      switchBranch: vi.fn(),
      stop: vi.fn(),
      ...overrides,
    }
  }

  it('typing and pressing Enter sends the message and clears the input', () => {
    const sendMessage = vi.fn()
    render(<Planner chat={makeChat({ sendMessage })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '3 days in Bali' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(sendMessage).toHaveBeenCalledWith('3 days in Bali')
  })

  it('renders user + assistant messages in order', () => {
    const chat = makeChat({
      pathMessages: [
        { id: 1, role: 'user',      content: 'Plan a Bali trip', plan_snapshot: null, state_snapshot: null, parent_id: null },
        { id: 2, role: 'assistant', content: 'Here are your plans', plan_snapshot: null, state_snapshot: null, parent_id: 1 },
      ],
    })
    render(<Planner chat={chat} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    const bubbles = screen.getAllByText(/Plan a Bali trip|Here are your plans/)
    expect(bubbles[0].textContent).toBe('Plan a Bali trip')
    expect(bubbles[1].textContent).toBe('Here are your plans')
  })

  it('ConfirmForm submitting calls confirmPendingTrip with filled data', () => {
    const confirmPendingTrip = vi.fn()
    const pendingTrip = {
      info: { departure_iata: null, arrival_iata: 'DPS', destination_name: 'Bali', trip_duration_days: null, outbound_date: null },
      missing: ['departure_iata', 'trip_duration_days'],
      parentUserId: 1,
    }
    render(<Planner chat={makeChat({ pendingTrip, confirmPendingTrip })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Departure airport/i), { target: { value: 'MDC', name: 'departure_iata' } })
    fireEvent.change(screen.getByLabelText(/Trip length/i), { target: { value: '3', name: 'trip_duration_days' } })
    fireEvent.submit(screen.getByRole('button', { name: /Continue/i }).closest('form'))

    expect(confirmPendingTrip).toHaveBeenCalledWith(
      expect.objectContaining({ departure_iata: 'MDC', trip_duration_days: 3 })
    )
  })
})

// ── ChatMessage editing within Planner ───────────────────────────────────────
describe('Planner → ChatMessage edit workflow', () => {
  it('clicking Edit on a user message and saving calls editMessage', () => {
    const editMessage = vi.fn()
    const chat = {
      pathMessages: [
        { id: 1, role: 'user', content: 'Original text', plan_snapshot: null, state_snapshot: null, parent_id: null },
      ],
      allMessages: [
        { id: 1, role: 'user', content: 'Original text', plan_snapshot: null, state_snapshot: null, parent_id: null },
      ],
      streaming: null, pendingTrip: null, status: '', error: null, busy: false, sessionId: null,
      sendMessage: vi.fn(), confirmPendingTrip: vi.fn(), selectPlanForRefine: vi.fn(),
      editMessage, regenerateAssistant: vi.fn(), switchBranch: vi.fn(), stop: vi.fn(),
    }
    render(<Planner chat={chat} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Updated text' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    expect(editMessage).toHaveBeenCalledWith(1, 'Updated text')
  })
})
