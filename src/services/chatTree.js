// Helpers for treating chat_messages as a tree keyed by parent_id.

export function indexById(messages) {
  const map = new Map()
  for (const m of messages) map.set(m.id, m)
  return map
}

export function childrenOf(messages, parentId) {
  return messages.filter((m) => m.parent_id === parentId)
}

// Walks from head toward the root, returns the ordered path [root, ..., head].
export function buildPath(messages, headId) {
  if (headId == null) return []
  const map = indexById(messages)
  const out = []
  let cur = map.get(headId)
  while (cur) {
    out.push(cur)
    cur = cur.parent_id != null ? map.get(cur.parent_id) : null
  }
  return out.reverse()
}

// Finds the deepest descendant along the "newest child" chain starting from the given message id.
// Used after creating a new branch: append head_message_id = the leaf of the new branch.
export function deepestDescendant(messages, startId) {
  let curId = startId
  while (true) {
    const kids = childrenOf(messages, curId)
    if (kids.length === 0) return curId
    // pick the most-recent child by id
    kids.sort((a, b) => b.id - a.id)
    curId = kids[0].id
  }
}

// For a message inside a path, returns sibling info { siblings, indexInSiblings }.
// "Siblings" means messages that share the same parent_id (including this one).
export function siblingInfo(messages, message) {
  if (!message) return { siblings: [], indexInSiblings: 0 }
  const sibs = childrenOf(messages, message.parent_id)
  sibs.sort((a, b) => a.id - b.id)
  const idx = sibs.findIndex((m) => m.id === message.id)
  return { siblings: sibs, indexInSiblings: idx }
}
