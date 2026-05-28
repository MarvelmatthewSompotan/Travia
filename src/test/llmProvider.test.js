import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/ollamaClient', () => ({
  ollamaGenerate: vi.fn().mockResolvedValue('ollama-resp'),
  ollamaStream: vi.fn().mockResolvedValue('ollama-stream'),
}))
vi.mock('../services/geminiClient', () => ({
  geminiGenerate: vi.fn().mockResolvedValue('gemini-resp'),
  geminiStream: vi.fn().mockResolvedValue('gemini-stream'),
}))

import { ollamaGenerate, ollamaStream } from '../services/ollamaClient'
import { geminiGenerate, geminiStream } from '../services/geminiClient'

let llmProvider

function safeClear() {
  try { window.localStorage.removeItem('travia_llm_provider') } catch { /* noop */ }
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  safeClear()
  llmProvider = await import('../services/llmProvider')
  llmProvider.setProvider('ollama')
})

afterEach(() => {
  safeClear()
})

describe('llmProvider — toggle', () => {
  it('getProvider returns the current provider', () => {
    llmProvider.setProvider('gemini')
    expect(llmProvider.getProvider()).toBe('gemini')
    llmProvider.setProvider('ollama')
    expect(llmProvider.getProvider()).toBe('ollama')
  })

  it('fires a llm-provider-change event when changed', () => {
    const handler = vi.fn()
    window.addEventListener('llm-provider-change', handler)
    llmProvider.setProvider('gemini')
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].detail).toBe('gemini')
    window.removeEventListener('llm-provider-change', handler)
  })
})

describe('llmProvider — llmGenerate routes to active provider', () => {
  it('calls ollamaGenerate when provider is ollama', async () => {
    llmProvider.setProvider('ollama')
    const r = await llmProvider.llmGenerate('sys', 'prompt')
    expect(r).toBe('ollama-resp')
    expect(ollamaGenerate).toHaveBeenCalled()
    expect(geminiGenerate).not.toHaveBeenCalled()
  })

  it('calls geminiGenerate when provider is gemini', async () => {
    llmProvider.setProvider('gemini')
    const r = await llmProvider.llmGenerate('sys', 'prompt')
    expect(r).toBe('gemini-resp')
    expect(geminiGenerate).toHaveBeenCalled()
    expect(ollamaGenerate).not.toHaveBeenCalled()
  })

  it('forwards system, prompt, and opts unchanged', async () => {
    llmProvider.setProvider('ollama')
    const opts = { json: false }
    await llmProvider.llmGenerate('sys', 'prompt', opts)
    expect(ollamaGenerate).toHaveBeenCalledWith('sys', 'prompt', opts)
  })
})

describe('llmProvider — llmStream routes to active provider', () => {
  it('calls ollamaStream when provider is ollama', async () => {
    llmProvider.setProvider('ollama')
    const onChunk = vi.fn()
    await llmProvider.llmStream('sys', 'prompt', onChunk)
    expect(ollamaStream).toHaveBeenCalled()
    expect(geminiStream).not.toHaveBeenCalled()
  })

  it('calls geminiStream when provider is gemini', async () => {
    llmProvider.setProvider('gemini')
    const onChunk = vi.fn()
    await llmProvider.llmStream('sys', 'prompt', onChunk)
    expect(geminiStream).toHaveBeenCalled()
    expect(ollamaStream).not.toHaveBeenCalled()
  })

  it('forwards system, prompt, onChunk, and opts to the chosen stream', async () => {
    llmProvider.setProvider('gemini')
    const onChunk = vi.fn()
    const opts = { signal: new AbortController().signal }
    await llmProvider.llmStream('s', 'p', onChunk, opts)
    expect(geminiStream).toHaveBeenCalledWith('s', 'p', onChunk, opts)
  })
})
