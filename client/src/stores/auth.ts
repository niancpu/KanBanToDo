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

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isAuthenticated = computed(() => !!token.value)

  const setAuth = async (t: string, u?: User) => {
    token.value = t
    localStorage.setItem('auth_token', t)
    if (u) user.value = u
    await initSync(u?.id || '', t, API_BASE)
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
    destroySync()
  }

  return { user, token, isAuthenticated, login, logout, register, verify, resendCode }
})
