const YOU_DECIDE_PATTERNS = [
  /you\s+decide/i,
  /surprise\s+me/i,
  /whatever\s+you\s+think/i,
  /up\s+to\s+you/i,
  /your\s+choice/i,
  /anything\s+(?:is\s+)?(?:fine|ok|okay|good)/i,
  /don'?t\s+(?:really\s+)?care/i,
  /doesn'?t\s+matter/i,
  /just\s+(?:pick|choose|decide)/i,
  /(?:i\s+)?trust\s+you/i,
  /no\s+preference/i,
  /whatever\s+works/i,
  /pick\s+(?:for\s+)?me/i,
]

export function detectYouDecideIntent(message) {
  if (!message) return false
  return YOU_DECIDE_PATTERNS.some((p) => p.test(message))
}

export function classifyIntent(message) {
  if (detectYouDecideIntent(message)) return 'you_decide'
  return 'explicit'
}
