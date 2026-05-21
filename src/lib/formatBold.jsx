export function formatBold(text) {
  if (text == null) return text
  const str = String(text)
  if (!str.includes('**')) return str
  return str.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  )
}
