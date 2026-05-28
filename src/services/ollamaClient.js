const OLLAMA_MODEL = 'llama3.2'
const OLLAMA_URL = 'http://localhost:11434/api/generate'

export async function ollamaGenerate(system, prompt, { signal, json = true } = {}) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system,
      prompt,
      stream: false,
      ...(json ? { format: 'json' } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.response
}

export async function ollamaStream(system, prompt, onChunk, { signal } = {}) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ model: OLLAMA_MODEL, system, prompt, stream: true }),
  })
  if (!res.ok || !res.body) {
    const text = res.body ? await res.text() : ''
    throw new Error(`Ollama error ${res.status}: ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let parsed
      try { parsed = JSON.parse(line) } catch { continue }
      if (typeof parsed.response === 'string' && parsed.response.length > 0) {
        full += parsed.response
        onChunk?.(parsed.response)
      }
      if (parsed.done) return full
    }
  }
  return full
}
