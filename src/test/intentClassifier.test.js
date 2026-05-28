import { describe, it, expect } from 'vitest'
import { detectYouDecideIntent, classifyIntent } from '../services/intentClassifier'

describe('detectYouDecideIntent', () => {
  it.each([
    'you decide',
    'You decide for me',
    'surprise me',
    'whatever you think',
    'up to you',
    'your choice',
    'anything is fine',
    'anything fine',
    "don't care",
    "don't really care",
    'doesn\'t matter',
    'just pick',
    'just choose for me',
    'just decide',
    'I trust you',
    'trust you',
    'no preference',
    'whatever works',
    'pick for me',
    'pick me a plan',
  ])('detects "%s" as you-decide intent', (msg) => {
    expect(detectYouDecideIntent(msg)).toBe(true)
  })

  it.each([
    'I want to go to Bali',
    'departing Monday',
    'how about a budget plan',
    '',
    null,
    undefined,
  ])('does NOT flag "%s" as you-decide', (msg) => {
    expect(detectYouDecideIntent(msg)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(detectYouDecideIntent('SURPRISE ME')).toBe(true)
    expect(detectYouDecideIntent('Up To You')).toBe(true)
  })
})

describe('classifyIntent', () => {
  it('returns "you_decide" when the message matches a you-decide pattern', () => {
    expect(classifyIntent('surprise me')).toBe('you_decide')
    expect(classifyIntent('up to you')).toBe('you_decide')
  })

  it('returns "explicit" for normal messages', () => {
    expect(classifyIntent('3-day trip from Manado to Bali')).toBe('explicit')
    expect(classifyIntent('change the hotel')).toBe('explicit')
  })
})
