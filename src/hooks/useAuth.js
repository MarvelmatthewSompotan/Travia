import { useState, useCallback } from 'react'
import { login as authLogin, logout as authLogout, register as authRegister, getStoredUser, getToken } from '../services/auth'

export function useAuth() {
  const [user, setUser] = useState(() => getStoredUser())
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const isAuthenticated = Boolean(user && getToken())

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const u = await authLogin(email, password)
      setUser(u)
      return u
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (name, email, password) => {
    setLoading(true)
    setError(null)
    try {
      const u = await authRegister(name, email, password)
      setUser(u)
      return u
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await authLogout()
    } finally {
      setUser(null)
      setLoading(false)
    }
  }, [])

  return { user, isAuthenticated, loading, error, login, register, logout }
}
