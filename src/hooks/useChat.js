import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  assemblePlan,
  extractTripInfo,
  fetchTripOptions,
  getMissingFields,
  normalizeTripInfo,
  ollamaStream,
  selectPlans,
} from '../lib/tripPipeline'
import { refinePlan } from '../lib/refinePlan'
import { buildPath, childrenOf, deepestDescendant } from '../lib/chatTree'

const PLAN_KEYS = ['best', 'budget', 'balanced']

function initialState() {
  return {
    sessionId: null,
    title: 'New chat',
    headMessageId: null,
    allMessages: [],
    pendingTrip: null,
    streaming: null, // { tempId, content }
    status: '',
    error: null,
    busy: false,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'reset': return initialState()
    case 'session-loaded':
      return {
        ...state,
        sessionId: action.session.id,
        title: action.session.title,
        headMessageId: action.session.head_message_id ?? null,
        allMessages: action.session.messages || [],
        pendingTrip: null,
        streaming: null,
        status: '',
        error: null,
      }
    case 'set-title':
      return { ...state, title: action.title }
    case 'set-head':
      return { ...state, headMessageId: action.id }
    case 'append-message':
      return { ...state, allMessages: [...state.allMessages, action.message] }
    case 'append-many':
      return { ...state, allMessages: [...state.allMessages, ...action.messages] }
    case 'streaming-start':
      return { ...state, streaming: { tempId: action.tempId, content: '' } }
    case 'streaming-chunk':
      return state.streaming
        ? { ...state, streaming: { ...state.streaming, content: state.streaming.content + action.chunk } }
        : state
    case 'streaming-stop':
      return { ...state, streaming: null }
    case 'set-status': return { ...state, status: action.status }
    case 'set-error': return { ...state, error: action.error }
    case 'set-busy': return { ...state, busy: action.busy }
    case 'set-pending-trip': return { ...state, pendingTrip: action.pendingTrip }
    default: return state
  }
}

function deriveStateAt(allMessages, headId) {
  const path = buildPath(allMessages, headId)
  let snapshot = null
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].role === 'assistant' && path[i].state_snapshot) {
      snapshot = path[i].state_snapshot
      break
    }
  }
  return { path, snapshot }
}

function planKeyOf(plan, sessionId) {
  return `${sessionId}::${plan?.title ?? ''}::${plan?.total_price ?? ''}`
}

async function streamNarrative(system, prompt, dispatch, signal) {
  const tempId = `stream-${Date.now()}`
  dispatch({ type: 'streaming-start', tempId })
  try {
    const full = await ollamaStream(system, prompt, (chunk) => {
      dispatch({ type: 'streaming-chunk', chunk })
    }, { signal })
    return (full ?? '').trim()
  } finally {
    dispatch({ type: 'streaming-stop' })
  }
}

export function useChat({ onSessionsChanged } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const abortRef = useRef(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const notifySessionsChanged = useCallback(() => {
    onSessionsChanged?.()
    setRefreshNonce((n) => n + 1)
  }, [onSessionsChanged])

  // --- Session lifecycle ---
  const newSession = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: 'reset' })
  }, [])

  const loadSession = useCallback(async (id) => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: 'set-busy', busy: true })
    dispatch({ type: 'set-error', error: null })
    try {
      const session = await api.getSession(id)
      dispatch({ type: 'session-loaded', session })
    } catch (err) {
      dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
    }
  }, [])

  const deleteSession = useCallback(async (id) => {
    try {
      await api.deleteSession(id)
      if (state.sessionId === id) dispatch({ type: 'reset' })
      notifySessionsChanged()
    } catch (err) {
      dispatch({ type: 'set-error', error: err.message })
    }
  }, [state.sessionId, notifySessionsChanged])

  // --- Persistence helpers ---
  async function ensureSession(currentSessionId, title) {
    if (currentSessionId) return currentSessionId
    const created = await api.createSession({ title: title || 'New chat' })
    dispatch({ type: 'session-loaded', session: { ...created, messages: [] } })
    notifySessionsChanged()
    return created.id
  }

  async function postMessage(sessionId, body) {
    const saved = await api.appendMessage(sessionId, body)
    dispatch({ type: 'append-message', message: saved })
    return saved
  }

  async function setHead(sessionId, messageId) {
    await api.patchSession(sessionId, { head_message_id: messageId })
    dispatch({ type: 'set-head', id: messageId })
    notifySessionsChanged()
  }

  async function setSessionTitle(sessionId, title) {
    await api.patchSession(sessionId, { title })
    dispatch({ type: 'set-title', title })
    notifySessionsChanged()
  }

  // --- Core: run the pipeline from a given user message id ---
  // Mode: 'intake' (no plans yet) | 'regenerate' (plans exist, re-pick) | 'refine' (one plan selected)
  async function runAssistantTurn({
    sessionId,
    parentUserId,
    userMessage,
    historyMessages,
    snapshot,
    signal,
  }) {
    // Decide mode
    let mode = 'intake'
    if (snapshot?.selected_plan) mode = 'refine'
    else if (snapshot?.cached_options) mode = 'regenerate'

    if (mode === 'intake') {
      dispatch({ type: 'set-status', status: 'Analyzing your trip…' })
      const info = await extractTripInfo(userMessage, { signal })
      const missing = getMissingFields(info)
      if (missing.length > 0) {
        dispatch({ type: 'set-pending-trip', pendingTrip: { info, missing, parentUserId } })
        dispatch({ type: 'set-status', status: '' })
        return null
      }
      return await runIntake({ sessionId, parentUserId, tripInfo: info, signal })
    }

    if (mode === 'regenerate') {
      const tripInfo = snapshot.trip_context
      const cached = snapshot.cached_options
      dispatch({ type: 'set-status', status: 'Re-running plan selection…' })
      const selections = await selectPlans(tripInfo, cached.flights, cached.places, cached.hotels, { signal })
      const plans = PLAN_KEYS.map((k) => assemblePlan(selections[k], tripInfo, cached.flights, cached.places, cached.hotels, cached.flightError))
      const note = await streamNarrative(
        'You are a concise travel assistant. In 2 short sentences, tell the user you regenerated 3 plans based on their latest message, and name the headline pick.',
        `User: ${userMessage}\nPlans: ${plans.map((p) => p.title).join(', ')}`,
        dispatch,
        signal,
      ).catch(() => '')
      dispatch({ type: 'set-status', status: '' })
      return await postAssistant({
        sessionId,
        parentUserId,
        content: note || `I regenerated 3 plans: ${plans.map((p) => p.title).join(', ')}.`,
        plan_snapshot: plans,
        state_snapshot: {
          trip_context: tripInfo,
          cached_options: cached,
          selected_plan_index: null,
          selected_plan: null,
        },
      })
    }

    // mode === 'refine'
    const tripInfo = snapshot.trip_context
    let cached = snapshot.cached_options
    let currentPlan = snapshot.selected_plan
    dispatch({ type: 'set-status', status: 'Refining your plan…' })
    const decision = await refinePlan({
      tripInfo,
      currentPlan,
      flights: cached.flights,
      hotels: cached.hotels,
      places: cached.places,
      chatHistory: historyMessages,
      userMessage,
    }, { signal })

    let nextTripInfo = tripInfo

    if (decision.kind === 'rerun') {
      const merged = normalizeTripInfo({ ...tripInfo, ...decision.changes })
      dispatch({ type: 'set-status', status: 'Searching flights, hotels & places for the new details…' })
      const fresh = await fetchTripOptions(merged)
      cached = fresh
      nextTripInfo = merged
      // Re-pick a balanced plan based on fresh options + the original tier mood (assume "balanced")
      dispatch({ type: 'set-status', status: 'Picking a fresh plan…' })
      const selections = await selectPlans(merged, fresh.flights, fresh.places, fresh.hotels, { signal })
      currentPlan = assemblePlan(selections.balanced, merged, fresh.flights, fresh.places, fresh.hotels, fresh.flightError)
    } else {
      // repick
      const reSel = {
        title: currentPlan?.title || 'Refined plan',
        brief: currentPlan?.brief || '',
        flight: decision.flight,
        hotel: decision.hotel,
        places: decision.places,
      }
      currentPlan = assemblePlan(reSel, tripInfo, cached.flights, cached.places, cached.hotels, cached.flightError)
    }

    const note = await streamNarrative(
      'You are a concise travel assistant. In 1-2 short sentences, summarize the change you just made for the user.',
      `User: ${userMessage}\nWhat changed: ${decision.note || (decision.kind === 'rerun' ? 'Searched new options.' : 'Swapped picks from the existing list.')}\nNew plan: hotel=${currentPlan.hotel?.name ?? 'n/a'}, places=${(currentPlan.places || []).map((p) => p.name).join('; ')}.`,
      dispatch,
      signal,
    ).catch(() => '')
    dispatch({ type: 'set-status', status: '' })

    return await postAssistant({
      sessionId,
      parentUserId,
      content: note || decision.note || 'Updated the plan.',
      plan_snapshot: [currentPlan],
      state_snapshot: {
        trip_context: nextTripInfo,
        cached_options: cached,
        selected_plan_index: snapshot.selected_plan_index,
        selected_plan: currentPlan,
      },
    })
  }

  async function runIntake({ sessionId, parentUserId, tripInfo, signal }) {
    const info = normalizeTripInfo(tripInfo)
    dispatch({ type: 'set-status', status: 'Searching flights, hotels & places…' })
    const cached = await fetchTripOptions(info)
    dispatch({ type: 'set-status', status: 'Creating your 3 recommendations…' })
    const selections = await selectPlans(info, cached.flights, cached.places, cached.hotels, { signal })
    const plans = PLAN_KEYS.map((k) => assemblePlan(selections[k], info, cached.flights, cached.places, cached.hotels, cached.flightError))
    const note = await streamNarrative(
      'You are a concise travel assistant. In 2 short sentences, present 3 travel plan tiers (Best / Budget / Balanced) and invite the user to pick one to refine.',
      `Trip: ${info.departure_city || info.departure_iata} → ${info.destination_name}, ${info.trip_duration_days} days.\nPlan titles: ${plans.map((p) => p.title).join(', ')}.`,
      dispatch,
      signal,
    ).catch(() => '')
    dispatch({ type: 'set-status', status: '' })

    return await postAssistant({
      sessionId,
      parentUserId,
      content: note || `Here are 3 options: ${plans.map((p) => p.title).join(', ')}. Pick one to refine it further.`,
      plan_snapshot: plans,
      state_snapshot: {
        trip_context: info,
        cached_options: cached,
        selected_plan_index: null,
        selected_plan: null,
      },
    })
  }

  async function postAssistant({ sessionId, parentUserId, content, plan_snapshot, state_snapshot, edited_from_id }) {
    const msg = await postMessage(sessionId, {
      role: 'assistant',
      parent_id: parentUserId,
      content,
      plan_snapshot,
      state_snapshot,
      edited_from_id: edited_from_id ?? null,
    })
    await setHead(sessionId, msg.id)
    return msg
  }

  // --- Public actions ---
  const sendMessage = useCallback(async (text) => {
    const userMessage = String(text || '').trim()
    if (!userMessage) return

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    dispatch({ type: 'set-busy', busy: true })
    dispatch({ type: 'set-error', error: null })

    try {
      const sessionId = await ensureSession(state.sessionId, userMessage.slice(0, 60))
      if (!state.sessionId && state.title === 'New chat') {
        await setSessionTitle(sessionId, userMessage.slice(0, 60))
      }
      const userMsg = await postMessage(sessionId, {
        role: 'user',
        parent_id: state.headMessageId,
        content: userMessage,
      })

      const { snapshot } = deriveStateAt([...state.allMessages, userMsg], userMsg.id)
      const history = buildPath([...state.allMessages, userMsg], userMsg.id)

      await runAssistantTurn({
        sessionId,
        parentUserId: userMsg.id,
        userMessage,
        historyMessages: history,
        snapshot,
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
      dispatch({ type: 'set-status', status: '' })
    }
  }, [state.sessionId, state.headMessageId, state.allMessages, state.title])

  const confirmPendingTrip = useCallback(async (filledInfo) => {
    const pending = state.pendingTrip
    if (!pending) return

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    dispatch({ type: 'set-busy', busy: true })
    dispatch({ type: 'set-error', error: null })
    dispatch({ type: 'set-pending-trip', pendingTrip: null })

    try {
      await runIntake({
        sessionId: state.sessionId,
        parentUserId: pending.parentUserId,
        tripInfo: filledInfo,
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
      dispatch({ type: 'set-status', status: '' })
    }
  }, [state.pendingTrip, state.sessionId])

  const selectPlanForRefine = useCallback(async (planIndex) => {
    const { path, snapshot } = deriveStateAt(state.allMessages, state.headMessageId)
    if (!snapshot || !Array.isArray(snapshot.cached_options ? path[path.length - 1].plan_snapshot : null)) return
    const headMsg = path[path.length - 1]
    const plans = headMsg.plan_snapshot || []
    if (!plans[planIndex]) return

    const sessionId = state.sessionId
    if (!sessionId) return
    dispatch({ type: 'set-busy', busy: true })
    try {
      // Synthetic user "I'll go with X" + assistant ack — preserves a head_message_id we can refine from.
      const userMsg = await postMessage(sessionId, {
        role: 'user',
        parent_id: state.headMessageId,
        content: `Let's go with the "${plans[planIndex].title}" plan and refine it.`,
      })
      const ack = await postAssistant({
        sessionId,
        parentUserId: userMsg.id,
        content: `Locked in "${plans[planIndex].title}". Tell me what you'd like to change.`,
        plan_snapshot: [plans[planIndex]],
        state_snapshot: {
          trip_context: snapshot.trip_context,
          cached_options: snapshot.cached_options,
          selected_plan_index: planIndex,
          selected_plan: plans[planIndex],
        },
      })
      return ack
    } catch (err) {
      dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
    }
  }, [state.allMessages, state.headMessageId, state.sessionId])

  const editMessage = useCallback(async (messageId, newContent) => {
    const target = state.allMessages.find((m) => m.id === messageId)
    if (!target || target.role !== 'user') return
    const sessionId = state.sessionId
    if (!sessionId) return

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    dispatch({ type: 'set-busy', busy: true })
    dispatch({ type: 'set-error', error: null })

    try {
      const userMsg = await postMessage(sessionId, {
        role: 'user',
        parent_id: target.parent_id,
        content: newContent,
        edited_from_id: target.id,
      })
      const { snapshot } = deriveStateAt(state.allMessages, target.parent_id)
      const history = buildPath([...state.allMessages, userMsg], userMsg.id)
      await runAssistantTurn({
        sessionId,
        parentUserId: userMsg.id,
        userMessage: newContent,
        historyMessages: history,
        snapshot,
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
      dispatch({ type: 'set-status', status: '' })
    }
  }, [state.allMessages, state.sessionId])

  const regenerateAssistant = useCallback(async (assistantMessageId) => {
    const target = state.allMessages.find((m) => m.id === assistantMessageId)
    if (!target || target.role !== 'assistant' || target.parent_id == null) return
    const parentUser = state.allMessages.find((m) => m.id === target.parent_id)
    if (!parentUser) return
    const sessionId = state.sessionId
    if (!sessionId) return

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    dispatch({ type: 'set-busy', busy: true })
    dispatch({ type: 'set-error', error: null })

    try {
      const { snapshot } = deriveStateAt(state.allMessages, parentUser.parent_id)
      const history = buildPath(state.allMessages, parentUser.id)
      await runAssistantTurn({
        sessionId,
        parentUserId: parentUser.id,
        userMessage: parentUser.content,
        historyMessages: history,
        snapshot,
        signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') dispatch({ type: 'set-error', error: err.message })
    } finally {
      dispatch({ type: 'set-busy', busy: false })
      dispatch({ type: 'set-status', status: '' })
    }
  }, [state.allMessages, state.sessionId])

  const switchBranch = useCallback(async (messageId) => {
    const tipId = deepestDescendant(state.allMessages, messageId)
    if (!state.sessionId) return
    await setHead(state.sessionId, tipId)
  }, [state.allMessages, state.sessionId])

  const savePlan = useCallback(async () => {
    const { snapshot } = deriveStateAt(state.allMessages, state.headMessageId)
    const plan = snapshot?.selected_plan
    if (!plan || !state.sessionId) return null
    const key = planKeyOf(plan, state.sessionId)
    return await api.savePlan({
      session_id: state.sessionId,
      plan_key: key,
      title: plan.title,
      brief: plan.brief,
      plan,
    })
  }, [state.allMessages, state.headMessageId, state.sessionId])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  // --- Derived for the view ---
  const { path: pathMessages, snapshot: headSnapshot } = deriveStateAt(state.allMessages, state.headMessageId)

  return {
    sessionId: state.sessionId,
    title: state.title,
    headMessageId: state.headMessageId,
    allMessages: state.allMessages,
    pathMessages,
    headSnapshot,
    streaming: state.streaming,
    pendingTrip: state.pendingTrip,
    status: state.status,
    error: state.error,
    busy: state.busy,
    refreshNonce,
    newSession,
    loadSession,
    deleteSession,
    sendMessage,
    confirmPendingTrip,
    selectPlanForRefine,
    editMessage,
    regenerateAssistant,
    switchBranch,
    savePlan,
    stop,
  }
}

// Hook for the sidebar's session list.
export function useSessionsList(refreshNonce) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    let cancelled = false
    api.listSessions()
      .then((rows) => { if (!cancelled) setSessions(rows ?? []) })
      .catch(() => { if (!cancelled) setSessions([]) })
    return () => { cancelled = true }
  }, [refreshNonce])

  return { sessions }
}

// Hook for saved plans (My Plans).
export function useSavedPlans(refreshNonce) {
  const [plans, setPlans] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    return api.listPlans()
      .then((rows) => { setPlans(rows ?? []); setError(null) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    api.listPlans()
      .then((rows) => { if (!cancelled) { setPlans(rows ?? []); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [refreshNonce])

  return {
    plans,
    error,
    reload,
    deletePlan: async (id) => {
      await api.deletePlan(id)
      return reload()
    },
  }
}

export function childrenOfMessage(allMessages, parentId) {
  return childrenOf(allMessages, parentId)
}
