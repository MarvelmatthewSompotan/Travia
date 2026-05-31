import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api } from '../services/api'
import {
  assemblePlan,
  extractAndMergeTripInfo,
  fetchTripOptions,
  fillDefaults,
  generateExperiencePrompt,
  generateFollowUp,
  generatePlan,
  generateReadyConfirmation,
  normalizeTripInfo,
  parseExperienceType,
  searchFlights,
} from '../services/tripPipeline'
import { llmStream } from '../services/llmProvider'
import { refinePlan } from '../services/refinePlan'
import { buildPath, childrenOf, deepestDescendant } from '../services/chatTree'
import { detectYouDecideIntent } from '../services/intentClassifier'

const MAX_INTAKE_TURNS = 3


function initialState() {
  return {
    sessionId: null,
    title: 'New chat',
    headMessageId: null,
    allMessages: [],
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
  const expType = plan?.experience_type || 'balanced'
  return `${sessionId}::${expType}::${Date.now()}`
}

async function streamNarrative(system, prompt, dispatch, signal) {
  const tempId = `stream-${Date.now()}`
  dispatch({ type: 'streaming-start', tempId })
  try {
    const full = await llmStream(system, prompt, (chunk) => {
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
  // Modes: 'intake' | 'experience' | 'refine'
  async function runAssistantTurn({
    sessionId,
    parentUserId,
    userMessage,
    historyMessages,
    snapshot,
    signal,
  }) {
    // Determine mode from snapshot
    let mode = 'intake'
    if (snapshot?.current_plan && !snapshot?.experience_confirmed) mode = 'experience'
    else if (snapshot?.current_plan && snapshot?.experience_confirmed) mode = 'refine'

    if (mode === 'intake') {
      const intakeTurns = historyMessages.filter(
        (m) => m.role === 'assistant' && !m.state_snapshot?.current_plan,
      ).length

      dispatch({ type: 'set-status', status: 'Understanding your trip…' })
      const history = historyMessages.map((m) => ({ role: m.role, content: String(m.content || '') }))
      const existingContext = snapshot?.trip_context || {}

      const { trip_context, ready_to_plan, missing_required, missing_optional } =
        await extractAndMergeTripInfo(history, existingContext, { signal })

      const youDecide = detectYouDecideIntent(userMessage)
      const forceRun = ready_to_plan || youDecide || intakeTurns >= MAX_INTAKE_TURNS

      if (!forceRun) {
        dispatch({ type: 'set-status', status: '' })
        const followUp = await generateFollowUp(
          trip_context, missing_required, missing_optional, history, { signal },
        ).catch(() => 'Could you tell me where you\'re flying from, where you\'re headed, and how many days you\'ll be away?')

        return await postAssistant({
          sessionId,
          parentUserId,
          content: followUp,
          plan_snapshot: null,
          state_snapshot: {
            trip_context,
            cached_options: null,
            current_plan: null,
            experience_confirmed: false,
          },
        })
      }

      const filledInfo = fillDefaults(trip_context)
      const confirmation = await generateReadyConfirmation(filledInfo, { signal }).catch(() => '')
      if (confirmation) dispatch({ type: 'set-status', status: confirmation })

      return await runIntake({ sessionId, parentUserId, tripInfo: filledInfo, signal })
    }

    if (mode === 'experience') {
      return await runExperienceMode({ sessionId, parentUserId, userMessage, snapshot, signal })
    }

    // mode === 'refine'
    const tripInfo = snapshot.trip_context
    let cached = snapshot.cached_options
    let currentPlan = snapshot.current_plan
    const pendingRefinement = snapshot.pending_refinement || null

    dispatch({ type: 'set-status', status: 'Thinking…' })
    const decision = await refinePlan({
      tripInfo,
      currentPlan,
      flights: cached.flights,
      hotels: cached.hotels,
      places: cached.places,
      chatHistory: historyMessages,
      userMessage,
      pendingRefinement,
    }, { signal })

    // General question — answer without touching the plan
    if (decision.kind === 'chat') {
      const reply = await streamNarrative(
        'You are a knowledgeable travel assistant. Answer naturally and helpfully.',
        decision.reply,
        dispatch,
        signal,
      ).catch(() => decision.reply)
      dispatch({ type: 'set-status', status: '' })
      return await postAssistant({
        sessionId,
        parentUserId,
        content: reply || decision.reply,
        plan_snapshot: [currentPlan],
        state_snapshot: {
          ...snapshot,
          pending_refinement: null,
        },
      })
    }

    // Needs clarification before running a full search
    if (decision.kind === 'ask') {
      dispatch({ type: 'set-status', status: '' })
      return await postAssistant({
        sessionId,
        parentUserId,
        content: decision.question,
        plan_snapshot: [currentPlan],
        state_snapshot: {
          trip_context: tripInfo,
          cached_options: cached,
          current_plan: currentPlan,
          experience_confirmed: true,
          pending_refinement: decision.proposed_changes,
        },
      })
    }

    let nextTripInfo = tripInfo

    if (decision.kind === 'rerun') {
      const merged = normalizeTripInfo({ ...tripInfo, ...decision.changes })
      nextTripInfo = merged

      if (decision.scope === 'flights') {
        dispatch({ type: 'set-status', status: 'Searching for new flights…' })
        const flightsResult = await searchFlights(
          merged.departure_iata, merged.arrival_iata, merged.outbound_date, merged.return_date,
        ).catch(() => ({ items: [], error: 'Flight search failed.' }))
        cached = {
          flights: flightsResult.items ?? [],
          flightError: flightsResult.error ?? null,
          places: cached.places,
          hotels: cached.hotels,
        }
      } else {
        dispatch({ type: 'set-status', status: 'Searching flights, hotels & places…' })
        const fresh = await fetchTripOptions(merged)
        cached = { flights: fresh.flights, flightError: fresh.flightError, places: fresh.places, hotels: fresh.hotels }
      }

      dispatch({ type: 'set-status', status: 'Picking a fresh plan…' })
      const sel = await generatePlan(nextTripInfo, cached, currentPlan?.experience_type || 'balanced', { signal })
      currentPlan = await assemblePlan(sel, nextTripInfo, cached.flights, cached.places, cached.hotels, cached.flightError)
      currentPlan.experience_type = sel.experience_type
    } else {
      // repick
      const reSel = {
        title: currentPlan?.title || 'Refined plan',
        brief: currentPlan?.brief || '',
        experience_type: currentPlan?.experience_type || 'balanced',
        flight: decision.flight,
        hotel: decision.hotel,
        places: decision.places,
      }
      currentPlan = await assemblePlan(reSel, tripInfo, cached.flights, cached.places, cached.hotels, cached.flightError)
      currentPlan.experience_type = reSel.experience_type
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
        current_plan: currentPlan,
        experience_confirmed: true,
        pending_refinement: null,
      },
    })
  }

  async function runIntake({ sessionId, parentUserId, tripInfo, signal }) {
    const info = normalizeTripInfo(tripInfo)
    dispatch({ type: 'set-status', status: 'Searching flights, hotels & places…' })
    const cached = await fetchTripOptions(info)
    dispatch({ type: 'set-status', status: 'Building your trip plan…' })
    const selection = await generatePlan(info, cached, 'balanced', { signal })
    const plan = await assemblePlan(selection, info, cached.flights, cached.places, cached.hotels, cached.flightError)
    plan.experience_type = 'balanced'

    // Stream plan presentation
    const note = await streamNarrative(
      'You are a concise travel assistant. In 2 short sentences, present this balanced trip plan and then ask what kind of experience the user wants.',
      `Trip: ${info.departure_city || info.departure_iata} → ${info.destination_name}, ${info.trip_duration_days} days. Plan: ${plan.title}.`,
      dispatch,
      signal,
    ).catch(() => '')

    // Stream the experience prompt as a natural follow-up
    const expPrompt = await generateExperiencePrompt(plan, info, { signal }).catch(() => '')
    dispatch({ type: 'set-status', status: '' })

    return await postAssistant({
      sessionId,
      parentUserId,
      content: [note, expPrompt].filter(Boolean).join('\n\n') || `Here is your trip plan: ${plan.title}. What kind of experience are you going for?`,
      plan_snapshot: [plan],
      state_snapshot: {
        trip_context: info,
        cached_options: cached,
        current_plan: plan,
        experience_confirmed: false,
      },
    })
  }

  async function runExperienceMode({ sessionId, parentUserId, userMessage, snapshot, signal }) {
    const { trip_context: tripInfo, cached_options: cached } = snapshot
    dispatch({ type: 'set-status', status: 'Interpreting your experience preference…' })
    const { experience_type } = await parseExperienceType(userMessage, { signal })

    dispatch({ type: 'set-status', status: `Building ${experience_type} plan…` })
    const selection = await generatePlan(tripInfo, cached, experience_type, { signal })
    const plan = await assemblePlan(selection, tripInfo, cached.flights, cached.places, cached.hotels, cached.flightError)
    plan.experience_type = experience_type

    // Auto-save this plan to the plans table
    const key = planKeyOf(plan, sessionId)
    await api.savePlan({
      session_id: sessionId,
      plan_key: key,
      experience_type,
      title: plan.title,
      brief: plan.brief,
      plan,
    }).catch(() => {})

    const note = await streamNarrative(
      'You are a concise travel assistant.',
      `The user wanted a ${experience_type} experience. You generated plan: ${plan.title}. In 2 sentences, present it and mention they can ask for another vibe (budget, luxury, food, adventure, etc.) or start refining this one.`,
      dispatch,
      signal,
    ).catch(() => '')
    dispatch({ type: 'set-status', status: '' })

    return await postAssistant({
      sessionId,
      parentUserId,
      content: note || `Here is your ${experience_type} plan: ${plan.title}.`,
      plan_snapshot: [plan],
      state_snapshot: {
        trip_context: tripInfo,
        cached_options: cached,
        current_plan: plan,
        experience_confirmed: true,
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
      // Set head to the user message immediately so the message + typing indicator render
      // while Ollama processes. postAssistant will call setHead again with the assistant id.
      await setHead(sessionId, userMsg.id)

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

  // Kept for API compatibility; no-op in single-plan mode (plans are selected automatically).
  const selectPlanForRefine = useCallback(() => {}, [])

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
    const plan = snapshot?.current_plan
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
    status: state.status,
    error: state.error,
    busy: state.busy,
    refreshNonce,
    newSession,
    loadSession,
    deleteSession,
    sendMessage,
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

  const reload = useCallback(async () => {
    try {
      const rows = await api.listPlans()
      setPlans(rows ?? [])
      setError(null)
    } catch (e) {
      setError(e.message)
    }
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
