import { api } from './api'

const TOKEN_KEY = 'rag_gfs_token'
const USER_KEY = 'rag_gfs_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

function persist(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clear() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function register(name, email, password) {
  const data = await api.register({ name, email, password })
  persist(data.token, data.user)
  return data.user
}

export async function login(email, password) {
  const data = await api.login({ email, password })
  persist(data.token, data.user)
  return data.user
}

export async function logout() {
  try {
    await api.logout()
  } finally {
    clear()
  }
}
