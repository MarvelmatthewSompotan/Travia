import { useEffect, useState } from 'react'
import { getProvider, setProvider as _setProvider } from '../services/llmProvider'

export function useLLMProvider() {
  const [provider, setLocal] = useState(getProvider)

  useEffect(() => {
    const handler = (e) => setLocal(e.detail)
    window.addEventListener('llm-provider-change', handler)
    return () => window.removeEventListener('llm-provider-change', handler)
  }, [])

  const toggle = () => _setProvider(provider === 'gemini' ? 'ollama' : 'gemini')

  return { provider, toggle }
}
