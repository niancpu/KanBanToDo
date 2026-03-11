import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@kanban/shared'
import { api } from '@/services/api'
import { initSync, destroySync } from '@/services/syncInstance'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface AuthResponse {
  access_token: string
  user: User
}

interface MeResponse {
  user: User
}

function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /^API Error (401|403):/i.test(error.message)
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(loadUser())
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isAuthenticated = computed(() => !!token.value)

  const setAuth = async (t: string, u?: User) => {
    token.value = t
    localStorage.setItem('auth_token', t)
    if (u) {
      user.value = u
      localStorage.setItem('auth_user', JSON.stringify(u))
    }
    try {
      await initSync(u?.id || user.value?.id || '', t, API_BASE)
    } catch (error) {
      console.warn('Init sync failed after login, keep local session:', error)
    }
  }

  const restoreSession = async () => {
    if (!token.value) return

    try {
      const res = await api.get<MeResponse>('/auth/me')
      user.value = res.user
      localStorage.setItem('auth_user', JSON.stringify(res.user))
      try {
        await initSync(res.user.id, token.value, API_BASE)
      } catch (error) {
        console.warn('Init sync failed during restore, keep local session:', error)
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        logout()
      } else {
        console.warn('Restore session failed due network/server, keep local session:', error)
      }
    }
  }

  const login = async (username: string, password?: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { username, password })
    await setAuth(res.access_token, res.user)
  }

  const register = async (username: string, password: string, email: string) => {
    const res = await api.post<{ needVerification: boolean }>('/auth/register', { username, password, email })
    return res
  }

  const verify = async (email: string, code: string) => {
    const res = await api.post<AuthResponse>('/auth/verify', { email, code })
    await setAuth(res.access_token, res.user)
  }

  const resendCode = async (email: string) => {
    await api.post('/auth/resend-code', { email })
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    destroySync()
  }

  return { user, token, isAuthenticated, login, logout, register, verify, resendCode, restoreSession }
})
