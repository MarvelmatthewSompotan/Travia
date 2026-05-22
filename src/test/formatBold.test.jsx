import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { formatBold } from '../services/formatBold'

describe('formatBold', () => {
  it('returns null as-is', () => {
    expect(formatBold(null)).toBeNull()
  })

  it('returns plain string unchanged when no ** markers', () => {
    const result = formatBold('Hello world')
    expect(result).toBe('Hello world')
  })

  it('converts **text** to a <strong> element', () => {
    const result = formatBold('Say **hello** now')
    const { container } = render(<>{result}</>)
    expect(container.querySelector('strong')).toBeTruthy()
    expect(container.querySelector('strong').textContent).toBe('hello')
    expect(container.textContent).toBe('Say hello now')
  })

  it('handles multiple bold spans', () => {
    const result = formatBold('**A** and **B**')
    const { container } = render(<>{result}</>)
    const strongs = container.querySelectorAll('strong')
    expect(strongs).toHaveLength(2)
    expect(strongs[0].textContent).toBe('A')
    expect(strongs[1].textContent).toBe('B')
  })

  it('handles bold at the start and end of string', () => {
    const result = formatBold('**start** middle **end**')
    const { container } = render(<>{result}</>)
    expect(container.querySelectorAll('strong')).toHaveLength(2)
  })

  it('coerces numbers to string', () => {
    const result = formatBold(42)
    expect(result).toBe('42')
  })

  it('returns the original string early when no ** present at all', () => {
    const result = formatBold('no markers here')
    expect(result).toBe('no markers here')
  })
})
