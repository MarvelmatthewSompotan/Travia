import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyPlans } from '../../components/Pages/MyPlans/MyPlans'
import { Planner } from '../../components/Pages/Planner/Planner'

// ── MyPlans ───────────────────────────────────────────────────────────────────
const savedPlans = [
  {
    id: 1,
    title: 'Bali Beach Trip',
    brief: 'Sun, sand and surf',
    plan: { title: 'Bali Beach Trip', brief: 'Sun, sand', total_price: 600, flight: null, hotel: null, places: [] },
  },
  {
    id: 2,
    title: 'Tokyo Weekend',
    brief: 'Temples and ramen',
    plan: { title: 'Tokyo Weekend', brief: 'Temples and ramen', total_price: 900, flight: null, hotel: null, places: [] },
  },
]

describe('MyPlans', () => {
  it('renders empty state when no plans', () => {
    render(<MyPlans savedPlans={[]} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/Plans you save/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Plan a trip/i })).toBeInTheDocument()
  })

  it('calls onSwitchToPlanner when CTA is clicked in empty state', () => {
    const onSwitchToPlanner = vi.fn()
    render(<MyPlans savedPlans={[]} onSwitchToPlanner={onSwitchToPlanner} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Plan a trip/i }))
    expect(onSwitchToPlanner).toHaveBeenCalledOnce()
  })

  it('renders plan cards when plans exist', () => {
    render(<MyPlans savedPlans={savedPlans} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Bali Beach Trip')).toBeInTheDocument()
    expect(screen.getByText('Tokyo Weekend')).toBeInTheDocument()
  })

  it('shows plan count subtitle', () => {
    render(<MyPlans savedPlans={savedPlans} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('2 saved plans')).toBeInTheDocument()
  })

  it('shows singular "plan" when count is 1', () => {
    render(<MyPlans savedPlans={[savedPlans[0]]} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('1 saved plan')).toBeInTheDocument()
  })

  it('opens plan detail when a card is clicked', () => {
    render(<MyPlans savedPlans={savedPlans} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Bali Beach Trip')))
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
  })

  it('returns to list when Back is clicked in detail view', () => {
    render(<MyPlans savedPlans={savedPlans} onSwitchToPlanner={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Bali Beach Trip')))
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText('Bali Beach Trip')).toBeInTheDocument()
    expect(screen.getByText('Tokyo Weekend')).toBeInTheDocument()
  })

  it('calls onDelete and returns to list when Remove is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<MyPlans savedPlans={savedPlans} onSwitchToPlanner={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.includes('Bali Beach Trip')))
    fireEvent.click(screen.getByRole('button', { name: /Remove from My Plans/i }))
    expect(onDelete).toHaveBeenCalledWith(1)
  })
})

// ── Planner ───────────────────────────────────────────────────────────────────
function makeChat(overrides = {}) {
  return {
    pathMessages: [],
    allMessages: [],
    streaming: null,
    status: '',
    error: null,
    busy: false,
    sessionId: null,
    sendMessage: vi.fn(),
    selectPlanForRefine: vi.fn(),
    editMessage: vi.fn(),
    regenerateAssistant: vi.fn(),
    switchBranch: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  }
}

describe('Planner', () => {
  it('renders Hero and suggestions when chat is empty', () => {
    render(<Planner chat={makeChat()} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    expect(screen.getByText(/Where to/i)).toBeInTheDocument()
  })

  it('calls sendMessage when a suggestion card is clicked', () => {
    const sendMessage = vi.fn()
    render(<Planner chat={makeChat({ sendMessage })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    fireEvent.click(screen.getByText('Cheapest dates').closest('button'))
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Bali'))
  })

  it('calls sendMessage when composer is submitted with Enter', () => {
    const sendMessage = vi.fn()
    render(<Planner chat={makeChat({ sendMessage })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Trip to Tokyo' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(sendMessage).toHaveBeenCalledWith('Trip to Tokyo')
  })

  it('renders messages when pathMessages is non-empty', () => {
    const chat = makeChat({
      pathMessages: [
        { id: 1, role: 'user', content: 'Plan my trip', plan_snapshot: null, state_snapshot: null, parent_id: null },
      ],
    })
    render(<Planner chat={chat} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    expect(screen.getByText('Plan my trip')).toBeInTheDocument()
  })

  it('shows TypingIndicator when busy and not streaming', () => {
    const chat = makeChat({
      busy: true,
      streaming: null,
      pathMessages: [
        { id: 1, role: 'user', content: 'Hey', plan_snapshot: null, state_snapshot: null, parent_id: null },
      ],
    })
    render(<Planner chat={chat} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders error message when chat.error is set', () => {
    render(<Planner chat={makeChat({ error: 'Something went wrong' })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('shows Stop button when busy and calls stop', () => {
    const stop = vi.fn()
    render(<Planner chat={makeChat({ busy: true, stop })} savedPlanKeys={new Set()} onSavePlan={vi.fn()} />)
    fireEvent.click(screen.getByText('Stop'))
    expect(stop).toHaveBeenCalledOnce()
  })
})
