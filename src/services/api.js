const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function getHeaders() {
  const token = localStorage.getItem('rag_gfs_token')
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...getHeaders(), ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status} ${path}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  listSessions: () => request('/api/sessions'),
  createSession: (data = {}) =>
    request('/api/sessions', { method: 'POST', body: JSON.stringify(data) }),
  getSession: (id) => request(`/api/sessions/${id}`),
  patchSession: (id, data) =>
    request(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),

  appendMessage: (sessionId, data) =>
    request(`/api/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify(data) }),

  listPlans: () => request('/api/plans'),
  savePlan: (data) => request('/api/plans', { method: 'POST', body: JSON.stringify(data) }),
  deletePlan: (id) => request(`/api/plans/${id}`, { method: 'DELETE' }),
}
