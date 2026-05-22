import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarMenu } from '../../components/Molecules/SidebarMenu/SidebarMenu'
import { PreviousChats } from '../../components/Molecules/PreviousChats/PreviousChats'
import { SuggestionCards } from '../../components/Molecules/SuggestionCards/SuggestionCards'
import { PlanCard } from '../../components/Molecules/PlanCard/PlanCard'
import { Composer } from '../../components/Molecules/Composer/Composer'
import { ConfirmForm } from '../../components/Molecules/ConfirmForm/ConfirmForm'
import { Hero } from '../../components/Molecules/Hero/Hero'

// ── SidebarMenu ───────────────────────────────────────────────────────────────
describe('SidebarMenu', () => {
  const items = [
    { id: 'planner', label: 'AI Travel Planner' },
    { id: 'plans',   label: 'My Plans', count: 3 },
  ]

  it('renders all nav items', () => {
    render(<SidebarMenu activeTab="planner" onTabChange={vi.fn()} items={items} />)
    expect(screen.getByText('AI Travel Planner')).toBeInTheDocument()
    expect(screen.getByText('My Plans')).toBeInTheDocument()
  })

  it('marks the active tab with active class', () => {
    render(<SidebarMenu activeTab="planner" onTabChange={vi.fn()} items={items} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('sidebar-menu__item--active')
    expect(buttons[1]).not.toHaveClass('sidebar-menu__item--active')
  })

  it('calls onTabChange with the item id when clicked', () => {
    const handler = vi.fn()
    render(<SidebarMenu activeTab="planner" onTabChange={handler} items={items} />)
    fireEvent.click(screen.getByText('My Plans').closest('button'))
    expect(handler).toHaveBeenCalledWith('plans')
  })

  it('shows count badge when count > 0', () => {
    render(<SidebarMenu activeTab="planner" onTabChange={vi.fn()} items={items} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not show count badge when count is 0 or absent', () => {
    const noCount = [{ id: 'planner', label: 'AI Travel Planner', count: 0 }]
    render(<SidebarMenu activeTab="planner" onTabChange={vi.fn()} items={noCount} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})

// ── PreviousChats ─────────────────────────────────────────────────────────────
const sessions = [
  { id: 'a1', title: 'Trip to Bali',   updated_at: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: 'b2', title: 'Tokyo weekend',  updated_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
]

describe('PreviousChats', () => {
  it('renders session titles', () => {
    render(<PreviousChats sessions={sessions} activeId={null} onPick={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    expect(screen.getByText('Trip to Bali')).toBeInTheDocument()
    expect(screen.getByText('Tokyo weekend')).toBeInTheDocument()
  })

  it('shows "No chats yet." when sessions is empty', () => {
    render(<PreviousChats sessions={[]} activeId={null} onPick={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    expect(screen.getByText('No chats yet.')).toBeInTheDocument()
  })

  it('hides the list when toggle is clicked', () => {
    render(<PreviousChats sessions={sessions} activeId={null} onPick={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    fireEvent.click(screen.getByText('Recent').closest('button'))
    expect(screen.queryByText('Trip to Bali')).toBeNull()
  })

  it('calls onPick with session id when a chat is clicked', () => {
    const onPick = vi.fn()
    render(<PreviousChats sessions={sessions} activeId={null} onPick={onPick} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    fireEvent.click(screen.getByText('Trip to Bali').closest('button'))
    expect(onPick).toHaveBeenCalledWith('a1')
  })

  it('calls onDelete with session id when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<PreviousChats sessions={sessions} activeId={null} onPick={vi.fn()} onDelete={onDelete} onNewChat={vi.fn()} />)
    fireEvent.click(screen.getAllByLabelText('Delete chat')[0])
    expect(onDelete).toHaveBeenCalledWith('a1')
  })

  it('calls onNewChat when "+ New chat" is clicked', () => {
    const onNewChat = vi.fn()
    render(<PreviousChats sessions={sessions} activeId={null} onPick={vi.fn()} onDelete={vi.fn()} onNewChat={onNewChat} />)
    fireEvent.click(screen.getByText('+ New chat'))
    expect(onNewChat).toHaveBeenCalledOnce()
  })

  it('marks the active session with active class', () => {
    render(<PreviousChats sessions={sessions} activeId="a1" onPick={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    const items = document.querySelectorAll('.prev-chats__item')
    expect(items[0]).toHaveClass('prev-chats__item--active')
    expect(items[1]).not.toHaveClass('prev-chats__item--active')
  })

  it('shows session count badge', () => {
    render(<PreviousChats sessions={sessions} activeId={null} onPick={vi.fn()} onDelete={vi.fn()} onNewChat={vi.fn()} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

// ── SuggestionCards ───────────────────────────────────────────────────────────
describe('SuggestionCards', () => {
  const items = [
    { icon: 'flight', tone: 'a', title: 'Beach trip', description: 'Sun and sand', prompt: '3 days in Bali' },
    { icon: 'food',   tone: 'b', title: 'Foodie tour', description: 'Eat everything', prompt: 'Food tour Singapore' },
  ]

  it('renders all suggestion titles', () => {
    render(<SuggestionCards items={items} onPick={vi.fn()} disabled={false} />)
    expect(screen.getByText('Beach trip')).toBeInTheDocument()
    expect(screen.getByText('Foodie tour')).toBeInTheDocument()
  })

  it('calls onPick with the prompt when a card is clicked', () => {
    const onPick = vi.fn()
    render(<SuggestionCards items={items} onPick={onPick} disabled={false} />)
    fireEvent.click(screen.getByText('Beach trip').closest('button'))
    expect(onPick).toHaveBeenCalledWith('3 days in Bali')
  })

  it('disables all buttons when disabled=true', () => {
    render(<SuggestionCards items={items} onPick={vi.fn()} disabled={true} />)
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled())
  })
})

// ── PlanCard ──────────────────────────────────────────────────────────────────
describe('PlanCard', () => {
  it('renders title and brief', () => {
    render(<PlanCard icon="🏆" title="Best Pick" brief="Great value" price={350} tone="a" onClick={vi.fn()} />)
    expect(screen.getByText('Best Pick')).toBeInTheDocument()
    expect(screen.getByText('Great value')).toBeInTheDocument()
  })

  it('renders formatted price', () => {
    render(<PlanCard icon="🏆" title="T" brief="B" price={1200} tone="a" onClick={vi.fn()} />)
    expect(screen.getByText(/\$1,200/)).toBeInTheDocument()
  })

  it('hides price when price is 0 or falsy', () => {
    render(<PlanCard icon="🏆" title="T" brief="B" price={0} tone="a" onClick={vi.fn()} />)
    expect(screen.queryByText(/\$/)).toBeNull()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<PlanCard icon="🏆" title="T" brief="B" price={100} tone="a" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies tone class', () => {
    render(<PlanCard icon="🏆" title="T" brief="B" price={100} tone="c" onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveClass('plan-card--c')
  })
})

// ── Composer ──────────────────────────────────────────────────────────────────
describe('Composer', () => {
  it('renders the textarea with the current value', () => {
    render(<Composer value="Hello" onChange={vi.fn()} onSubmit={vi.fn()} busy={false} />)
    expect(screen.getByRole('textbox')).toHaveValue('Hello')
  })

  it('calls onChange when the textarea value changes', () => {
    const onChange = vi.fn()
    render(<Composer value="" onChange={onChange} onSubmit={vi.fn()} busy={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hi' } })
    expect(onChange).toHaveBeenCalledWith('Hi')
  })

  it('calls onSubmit when Enter is pressed (without Shift)', () => {
    const onSubmit = vi.fn()
    render(<Composer value="Send this" onChange={vi.fn()} onSubmit={onSubmit} busy={false} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false })
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('does not call onSubmit when Shift+Enter is pressed', () => {
    const onSubmit = vi.fn()
    render(<Composer value="text" onChange={vi.fn()} onSubmit={onSubmit} busy={false} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit when value is empty', () => {
    const onSubmit = vi.fn()
    render(<Composer value="   " onChange={vi.fn()} onSubmit={onSubmit} busy={false} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows Stop button when busy and onStop is provided', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} onStop={vi.fn()} busy={true} />)
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn()
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} onStop={onStop} busy={true} />)
    fireEvent.click(screen.getByText('Stop'))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('disables the send button when value is empty', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} busy={false} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})

// ── ConfirmForm ───────────────────────────────────────────────────────────────
describe('ConfirmForm', () => {
  const pendingTrip = {
    info: {
      departure_iata: null,
      departure_city: null,
      arrival_iata: 'DPS',
      destination_name: 'Bali, Indonesia',
      trip_duration_days: null,
      outbound_date: null,
    },
    missing: ['departure_iata', 'trip_duration_days'],
    parentUserId: 1,
  }

  it('pre-fills fields from info', () => {
    render(<ConfirmForm pendingTrip={pendingTrip} onConfirm={vi.fn()} disabled={false} />)
    expect(screen.getByLabelText(/Arrival airport/i)).toHaveValue('DPS')
    expect(screen.getByLabelText(/Destination/i)).toHaveValue('Bali, Indonesia')
  })

  it('updates field when user types', () => {
    render(<ConfirmForm pendingTrip={pendingTrip} onConfirm={vi.fn()} disabled={false} />)
    const input = screen.getByLabelText(/Departure airport/i)
    fireEvent.change(input, { target: { value: 'MDC', name: 'departure_iata' } })
    expect(input).toHaveValue('MDC')
  })

  it('calls onConfirm with uppercased IATA and numeric duration on submit', () => {
    const onConfirm = vi.fn()
    render(<ConfirmForm pendingTrip={pendingTrip} onConfirm={onConfirm} disabled={false} />)
    fireEvent.change(screen.getByLabelText(/Departure airport/i), { target: { value: 'mdc', name: 'departure_iata' } })
    fireEvent.change(screen.getByLabelText(/Trip length/i), { target: { value: '3', name: 'trip_duration_days' } })
    fireEvent.submit(screen.getByRole('button', { name: /Continue/i }).closest('form'))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ departure_iata: 'MDC', trip_duration_days: 3 })
    )
  })

  it('disables submit button when disabled=true', () => {
    render(<ConfirmForm pendingTrip={pendingTrip} onConfirm={vi.fn()} disabled={true} />)
    expect(screen.getByRole('button', { name: /Working/i })).toBeDisabled()
  })
})

// ── Hero ──────────────────────────────────────────────────────────────────────
describe('Hero', () => {
  it('renders title with accent word highlighted', () => {
    render(<Hero title="Where to" accent="next" subtitle="Plan your trip" />)
    expect(screen.getByText(/Where to/)).toBeInTheDocument()
    expect(screen.getByText('next')).toBeInTheDocument()
  })

  it('renders subtitle', () => {
    render(<Hero title="T" accent="A" subtitle="Describe your trip" />)
    expect(screen.getByText('Describe your trip')).toBeInTheDocument()
  })
})
