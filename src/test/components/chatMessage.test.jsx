import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatMessage } from '../../components/Molecules/ChatMessage/ChatMessage'

const baseProps = {
  allMessages: [],
  isStreaming: false,
  streamingContent: '',
  onEdit: vi.fn(),
  onRegenerate: vi.fn(),
  onSwitchBranch: vi.fn(),
  onSelectPlan: vi.fn(),
  onSavePlan: vi.fn(),
  isSavedHere: false,
  disabled: false,
}

// ── User message ──────────────────────────────────────────────────────────────
describe('ChatMessage — user role', () => {
  const msg = { id: 1, role: 'user', content: 'Hello there', plan_snapshot: null, state_snapshot: null, parent_id: null }

  it('renders the message content', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('shows Edit button', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('enters edit mode when Edit is clicked', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox')).toHaveValue('Hello there')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancels edit and restores original content', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('calls onEdit with id and new text on Save & resend', () => {
    const onEdit = vi.fn()
    render(<ChatMessage {...baseProps} message={msg} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Updated message' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    expect(onEdit).toHaveBeenCalledWith(1, 'Updated message')
  })

  it('disables Edit button when disabled=true', () => {
    render(<ChatMessage {...baseProps} message={msg} disabled={true} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
  })
})

// ── Assistant message — plain text ────────────────────────────────────────────
describe('ChatMessage — assistant role (text only)', () => {
  const msg = { id: 2, role: 'assistant', content: 'Here is your plan!', plan_snapshot: null, state_snapshot: null, parent_id: null }

  it('renders the assistant content', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    expect(screen.getByText('Here is your plan!')).toBeInTheDocument()
  })

  it('shows Regenerate button', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
  })

  it('calls onRegenerate with message id', () => {
    const onRegenerate = vi.fn()
    render(<ChatMessage {...baseProps} message={msg} onRegenerate={onRegenerate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(onRegenerate).toHaveBeenCalledWith(2)
  })

  it('shows placeholder dots when streaming with empty content', () => {
    render(<ChatMessage {...baseProps} message={{ ...msg, content: '' }} isStreaming={true} streamingContent="" />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('shows streaming content while streaming', () => {
    render(<ChatMessage {...baseProps} message={{ ...msg, content: '' }} isStreaming={true} streamingContent="Thinking..." />)
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('hides Regenerate button while streaming', () => {
    render(<ChatMessage {...baseProps} message={msg} isStreaming={true} streamingContent="..." />)
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull()
  })
})

// ── Assistant message — trip plan card ───────────────────────────────────────
describe('ChatMessage — assistant role (trip plan card)', () => {
  const selectedPlan = { title: 'Bali Trip', brief: 'Beaches and temples', total_price: 500, flight: null, hotel: null, places: [] }
  const msg = {
    id: 3,
    role: 'assistant',
    content: 'Here is your trip plan',
    plan_snapshot: [selectedPlan],
    state_snapshot: { selected_plan: selectedPlan, cached_options: {}, trip_context: {} },
    parent_id: null,
  }

  it('renders "Save plan" button', () => {
    render(<ChatMessage {...baseProps} message={msg} />)
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeInTheDocument()
  })

  it('calls onSavePlan when Save plan is clicked', () => {
    const onSavePlan = vi.fn()
    render(<ChatMessage {...baseProps} message={msg} onSavePlan={onSavePlan} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))
    expect(onSavePlan).toHaveBeenCalledOnce()
  })

  it('shows "Saved" and disables the button when isSavedHere=true', () => {
    render(<ChatMessage {...baseProps} message={msg} isSavedHere={true} />)
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
  })
})

// ── Branch arrows ─────────────────────────────────────────────────────────────
describe('ChatMessage — branch arrows', () => {
  const allMessages = [
    { id: 1, parent_id: null,  role: 'user',      content: 'First' },
    { id: 2, parent_id: 1,     role: 'assistant',  content: 'Branch A', plan_snapshot: null, state_snapshot: null },
    { id: 3, parent_id: 1,     role: 'assistant',  content: 'Branch B', plan_snapshot: null, state_snapshot: null },
  ]

  it('shows branch navigation when siblings exist', () => {
    render(<ChatMessage {...baseProps} message={allMessages[1]} allMessages={allMessages} />)
    expect(screen.getByLabelText('Previous branch')).toBeInTheDocument()
    expect(screen.getByLabelText('Next branch')).toBeInTheDocument()
  })

  it('calls onSwitchBranch when navigating to next branch', () => {
    const onSwitchBranch = vi.fn()
    render(<ChatMessage {...baseProps} message={allMessages[1]} allMessages={allMessages} onSwitchBranch={onSwitchBranch} />)
    fireEvent.click(screen.getByLabelText('Next branch'))
    expect(onSwitchBranch).toHaveBeenCalledWith(3)
  })

  it('does not show branch arrows when there are no siblings', () => {
    const singleMsg = { id: 2, parent_id: 1, role: 'assistant', content: 'Only', plan_snapshot: null, state_snapshot: null }
    const msgs = [{ id: 1, parent_id: null, role: 'user', content: 'Hi' }, singleMsg]
    render(<ChatMessage {...baseProps} message={singleMsg} allMessages={msgs} />)
    expect(screen.queryByLabelText('Previous branch')).toBeNull()
  })
})
