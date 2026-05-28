import { ollamaGenerate, ollamaStream } from './ollamaClient.js'
import { geminiGenerate, geminiStream } from './geminiClient.js'

const ENV_DEFAULT = import.meta.env.VITE_LLM_PROVIDER ?? 'gemini'

function readStored() {
  try { return localStorage.getItem('travia_llm_provider') || ENV_DEFAULT } catch { return ENV_DEFAULT }
}

let _provider = readStored()

export function getProvider() {
  return _provider
}

export function setProvider(p) {
  _provider = p
  try { localStorage.setItem('travia_llm_provider', p) } catch { /* storage unavailable */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('llm-provider-change', { detail: p }))
  }
}

export async function llmGenerate(system, prompt, opts) {
  if (_provider === 'gemini') return geminiGenerate(system, prompt, opts)
  return ollamaGenerate(system, prompt, opts)
}

export async function llmStream(system, prompt, onChunk, opts) {
  if (_provider === 'gemini') return geminiStream(system, prompt, onChunk, opts)
  return ollamaStream(system, prompt, onChunk, opts)
}
