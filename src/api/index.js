import { apiUrl } from '@/config.js'

function authHeaders() {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function apiPost(path, body = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      const err = JSON.parse(text)
      message = err.msg || err.message || text
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export async function apiGet(path) {
  const res = await fetch(apiUrl(path), {
    method: 'GET',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      const err = JSON.parse(text)
      message = err.msg || err.message || text
    } catch {}
    throw new Error(message)
  }
  return res.json()
}
