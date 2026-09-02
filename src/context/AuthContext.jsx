import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'
import { dismissAppSplash } from '../utils/splash'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('wpds_user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(!!localStorage.getItem('wpds_token'))

  useEffect(() => {
    const token = localStorage.getItem('wpds_token')
    if (!token) {
      setLoading(false)
      dismissAppSplash()
      return
    }
    api
      .get('/me')
      .then((res) => {
        setUser(res.data.user)
        localStorage.setItem('wpds_user', JSON.stringify(res.data.user))
      })
      .catch(() => {
        setUser(null)
        localStorage.removeItem('wpds_token')
        localStorage.removeItem('wpds_user')
      })
      .finally(() => {
        setLoading(false)
        dismissAppSplash()
      })
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/login', { email, password })
    localStorage.setItem('wpds_token', data.token)
    localStorage.setItem('wpds_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  async function logout() {
    try {
      await api.post('/logout')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('wpds_token')
    localStorage.removeItem('wpds_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
