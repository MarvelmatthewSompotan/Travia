import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../components/Atoms/Button/Button'
import { Chip } from '../../components/Atoms/Chip/Chip'
import { Toast } from '../../components/Atoms/Toast/Toast'
import { TypingIndicator } from '../../components/Atoms/TypingIndicator/TypingIndicator'
import { Avatar } from '../../components/Atoms/Avatar/Avatar'
import { StatusDot } from '../../components/Atoms/StatusDot/StatusDot'

// ── Button ────────────────────────────────────────────────────────────────────
describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies default variant and size classes', () => {
    render(<Button>x</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--default', 'btn--md')
  })

  it('applies custom variant class', () => {
    render(<Button variant="primary">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--primary')
  })

  it('applies custom size class', () => {
    render(<Button size="sm">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--sm')
  })

  it('merges extra className', () => {
    render(<Button className="extra">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('extra')
  })

  it('fires onClick when clicked', () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>x</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('respects disabled prop', () => {
    render(<Button disabled>x</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

// ── Chip ──────────────────────────────────────────────────────────────────────
describe('Chip', () => {
  it('renders label text', () => {
    render(<Chip>Economy</Chip>)
    expect(screen.getByText('Economy')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<Chip icon="✈">Economy</Chip>)
    expect(screen.getByText('✈')).toBeInTheDocument()
  })

  it('does not render icon span when icon is falsy', () => {
    const { container } = render(<Chip>Economy</Chip>)
    expect(container.querySelector('.chip__icon')).toBeNull()
  })

  it('adds chip--active class when active=true', () => {
    render(<Chip active>Economy</Chip>)
    expect(screen.getByRole('button')).toHaveClass('chip--active')
  })

  it('does not add chip--active when active=false', () => {
    render(<Chip active={false}>Economy</Chip>)
    expect(screen.getByRole('button')).not.toHaveClass('chip--active')
  })

  it('calls onClick when clicked', () => {
    const handler = vi.fn()
    render(<Chip onClick={handler}>Economy</Chip>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })
})

// ── Toast ─────────────────────────────────────────────────────────────────────
describe('Toast', () => {
  it('renders message text', () => {
    render(<Toast message="Saved successfully" />)
    expect(screen.getByText('Saved successfully')).toBeInTheDocument()
  })

  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when message is empty string', () => {
    const { container } = render(<Toast message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('has role="status" for accessibility', () => {
    render(<Toast message="Done" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

// ── TypingIndicator ───────────────────────────────────────────────────────────
describe('TypingIndicator', () => {
  it('renders with role="status"', () => {
    render(<TypingIndicator label="Working…" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the label text', () => {
    render(<TypingIndicator label="Searching flights" />)
    expect(screen.getByText('Searching flights')).toBeInTheDocument()
  })

  it('renders without label when label is falsy', () => {
    const { container } = render(<TypingIndicator />)
    expect(container.querySelector('.typing-indicator__label')).toBeNull()
  })

  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />)
    expect(container.querySelectorAll('.typing-indicator__dot')).toHaveLength(3)
  })
})

// ── Avatar ────────────────────────────────────────────────────────────────────
describe('Avatar', () => {
  it('renders the provided initial', () => {
    render(<Avatar initial="J" />)
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('defaults to "M" when no initial provided', () => {
    render(<Avatar />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})

// ── StatusDot ─────────────────────────────────────────────────────────────────
describe('StatusDot', () => {
  it('renders with the given tone class', () => {
    const { container } = render(<StatusDot tone="sky" />)
    expect(container.firstChild).toHaveClass('status-dot--sky')
  })

  it('defaults to tone="mint"', () => {
    const { container } = render(<StatusDot />)
    expect(container.firstChild).toHaveClass('status-dot--mint')
  })
})
