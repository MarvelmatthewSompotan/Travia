import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geminiGenerate, geminiStream } from '../services/geminiClient'

const originalFetch = globalThis.fetch

function mockFetch(json) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => json,
  })
}

function mockFetchError(status, text) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => text,
  })
}

function ndjsonStreamResponse(chunks) {
  const encoder = new TextEncoder()
  const lines = chunks.map((c) => `data: ${JSON.stringify(c)}\n`).join('')
  return {
    ok: true,
    body: {
      getReader: () => {
        let sent = false
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined }
            sent = true
            return { done: false, value: encoder.encode(lines) }
          },
        }
      },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ── geminiGenerate ────────────────────────────────────────────────────────────
describe('geminiGenerate', () => {
  it('parses text from candidates[0].content.parts[0].text', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
    const result = await geminiGenerate('sys', 'prompt')
    expect(result).toBe('{"ok":true}')
  })

  it('returns empty string when no candidates are returned', async () => {
    mockFetch({})
    const result = await geminiGenerate('sys', 'prompt')
    expect(result).toBe('')
  })

  it('sends system_instruction in the request body', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await geminiGenerate('be brief', 'hello')
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.system_instruction.parts[0].text).toBe('be brief')
    expect(body.contents[0].parts[0].text).toBe('hello')
  })

  it('includes generationConfig.responseMimeType=application/json by default', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await geminiGenerate('s', 'p')
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.generationConfig?.responseMimeType).toBe('application/json')
  })

  it('omits generationConfig when json=false', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await geminiGenerate('s', 'p', { json: false })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.generationConfig).toBeUndefined()
  })

  it('appends the api key as a query param', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await geminiGenerate('s', 'p')
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toMatch(/key=/)
  })

  it('throws when the response is not ok', async () => {
    mockFetchError(429, '{"error":"quota exceeded"}')
    await expect(geminiGenerate('s', 'p')).rejects.toThrow(/Gemini error 429/)
  })
})

// ── geminiStream ──────────────────────────────────────────────────────────────
describe('geminiStream', () => {
  it('emits each chunk and returns the full text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(ndjsonStreamResponse([
      { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'world!' }] } }] },
    ]))
    const chunks = []
    const full = await geminiStream('s', 'p', (c) => chunks.push(c))
    expect(chunks).toEqual(['Hello ', 'world!'])
    expect(full).toBe('Hello world!')
  })

  it('stops on finishReason=STOP', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(ndjsonStreamResponse([
      { candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }] },
    ]))
    const chunks = []
    const full = await geminiStream('s', 'p', (c) => chunks.push(c))
    expect(full).toBe('done')
  })

  it('uses the streaming endpoint URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(ndjsonStreamResponse([
      { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
    ]))
    await geminiStream('s', 'p', () => {})
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toMatch(/streamGenerateContent/)
    expect(url).toMatch(/alt=sse/)
  })

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: { /* truthy so res.text() is reached */ },
      text: async () => 'server error',
    })
    await expect(geminiStream('s', 'p', () => {})).rejects.toThrow(/Gemini error 500/)
  })
})
