import { describe, it, expect } from 'vitest'
import { buildPath, childrenOf, siblingInfo, deepestDescendant, indexById } from '../services/chatTree'

const msgs = [
  { id: 1, parent_id: null,  role: 'user',      content: 'Hello' },
  { id: 2, parent_id: 1,     role: 'assistant',  content: 'Hi there' },
  { id: 3, parent_id: 1,     role: 'assistant',  content: 'Hi v2 (branch)' },
  { id: 4, parent_id: 2,     role: 'user',       content: 'Follow-up' },
  { id: 5, parent_id: 4,     role: 'assistant',  content: 'Answer' },
]

describe('indexById', () => {
  it('creates a Map keyed by id', () => {
    const map = indexById(msgs)
    expect(map.get(1)).toBe(msgs[0])
    expect(map.get(5)).toBe(msgs[4])
  })
})

describe('buildPath', () => {
  it('returns empty array when headId is null', () => {
    expect(buildPath(msgs, null)).toEqual([])
  })

  it('returns single-item path for root message', () => {
    expect(buildPath(msgs, 1)).toEqual([msgs[0]])
  })

  it('returns full ancestor chain in root-to-head order', () => {
    expect(buildPath(msgs, 5)).toEqual([msgs[0], msgs[1], msgs[3], msgs[4]])
  })

  it('follows the branch that leads to the given head', () => {
    // head = 3 (sibling of 2, child of 1) — path should be [1, 3]
    expect(buildPath(msgs, 3)).toEqual([msgs[0], msgs[2]])
  })

  it('returns empty array when headId is not in messages', () => {
    expect(buildPath(msgs, 999)).toEqual([])
  })
})

describe('childrenOf', () => {
  it('returns direct children of a given parent', () => {
    const children = childrenOf(msgs, 1)
    expect(children).toHaveLength(2)
    expect(children.map((m) => m.id)).toEqual(expect.arrayContaining([2, 3]))
  })

  it('returns empty array for a leaf node', () => {
    expect(childrenOf(msgs, 5)).toEqual([])
  })

  it('returns root messages when parentId is null', () => {
    const roots = childrenOf(msgs, null)
    expect(roots).toHaveLength(1)
    expect(roots[0].id).toBe(1)
  })
})

describe('siblingInfo', () => {
  it('returns siblings sorted by id and correct index', () => {
    const { siblings, indexInSiblings } = siblingInfo(msgs, msgs[1]) // message id=2
    expect(siblings.map((m) => m.id)).toEqual([2, 3])
    expect(indexInSiblings).toBe(0)
  })

  it('returns index 1 for the second sibling', () => {
    const { indexInSiblings } = siblingInfo(msgs, msgs[2]) // message id=3
    expect(indexInSiblings).toBe(1)
  })

  it('returns siblings of length 1 for a node with no siblings', () => {
    const { siblings } = siblingInfo(msgs, msgs[0]) // root, only child of null
    expect(siblings).toHaveLength(1)
  })

  it('returns empty siblings and index 0 for null message', () => {
    const { siblings, indexInSiblings } = siblingInfo(msgs, null)
    expect(siblings).toHaveLength(0)
    expect(indexInSiblings).toBe(0)
  })
})

describe('deepestDescendant', () => {
  it('returns the id itself when it has no children', () => {
    expect(deepestDescendant(msgs, 5)).toBe(5)
  })

  it('follows the newest-child chain to the leaf', () => {
    // From 1: children are 2 and 3. Newest by id is 3. 3 has no children → 3.
    expect(deepestDescendant(msgs, 1)).toBe(3)
  })

  it('follows a deeper chain', () => {
    // From 2: child is 4. From 4: child is 5. → 5.
    expect(deepestDescendant(msgs, 2)).toBe(5)
  })
})
