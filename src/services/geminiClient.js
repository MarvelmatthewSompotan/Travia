const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getGeminiKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('Missing VITE_GEMINI_API_KEY. Set it in .env and restart the dev server.')
  return key
}

export async function geminiGenerate(system, prompt, { signal, json = true } = {}) {
  const key = getGeminiKey()
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  }

  const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function geminiStream(system, prompt, onChunk, { signal } = {}) {
  const key = getGeminiKey()
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  }

  const res = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?key=${key}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(body),
    },
  )
  if (!res.ok || !res.body) {
    const text = res.body ? await res.text() : ''
    throw new Error(`Gemini error ${res.status}: ${text}`)
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
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return full
      try {
        const parsed = JSON.parse(raw)
        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (chunk) {
          full += chunk
          onChunk?.(chunk)
        }
        if (parsed.candidates?.[0]?.finishReason === 'STOP') return full
      } catch { continue }
    }
  }
  return full
}
