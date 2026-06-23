import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiPost } from '@/api/index.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const username = ref(localStorage.getItem('username') || '')
  const role = ref(localStorage.getItem('role') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'admin')

  function setAuth(newToken, newUsername, newRole) {
    token.value = newToken
    username.value = newUsername
    role.value = newRole || ''
    localStorage.setItem('token', newToken)
    localStorage.setItem('username', newUsername)
    if (newRole) localStorage.setItem('role', newRole)
  }

  function clearAuth() {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
  }

  async function login(uname, password) {
    const data = await apiPost('/v1/client/auth/login', { username: uname, password })
    setAuth(data.token, data.username, data.role)
    return data
  }

  async function register(uname, password) {
    const data = await apiPost('/v1/client/auth/register', { username: uname, password })
    return data
  }

  function logout() {
    clearAuth()
  }

  return { token, username, role, isLoggedIn, isAdmin, login, register, logout, clearAuth }
})
