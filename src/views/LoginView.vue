<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (isLoading.value) return
  errorMsg.value = ''
  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  isLoading.value = true
  try {
    const data = await auth.login(username.value.trim(), password.value)
    if (data.role === 'admin') {
      router.replace('/admin')
    } else {
      router.replace('/client')
    }
  } catch (err) {
    errorMsg.value = err.message || '登录失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-card">
      <h1>自动打电话系统</h1>
      <p class="subtitle">管理员登录</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label>用户名</label>
          <input
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            autocomplete="username"
            :disabled="isLoading"
          />
        </div>

        <div class="field">
          <label>密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="isLoading"
          />
        </div>

        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <button class="login-btn" type="submit" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登 录' }}
        </button>

        <p class="footer-link">
          没有账号？<router-link to="/register">去注册</router-link>
        </p>
      </form>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-background);
}

.login-card {
  width: 380px;
  max-width: 90vw;
  padding: 2.5rem 2rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  text-align: center;
}

.login-card h1 {
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.subtitle {
  color: var(--color-text);
  opacity: 0.6;
  font-size: 0.9rem;
  margin: 0 0 2rem;
}

.login-form {
  text-align: left;
}

.field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.field input {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: hsla(160, 100%, 37%, 1);
}

.field input:disabled {
  opacity: 0.6;
}

.error {
  background-color: hsla(0, 70%, 50%, 0.1);
  color: hsla(0, 70%, 50%, 1);
  border: 1px solid hsla(0, 70%, 50%, 0.3);
  padding: 0.6rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.login-btn {
  width: 100%;
  padding: 0.65rem;
  font-size: 1rem;
  background-color: hsla(160, 100%, 37%, 1);
  border: none;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background-color 0.2s;
}

.login-btn:not(:disabled):hover {
  background-color: hsla(160, 100%, 32%, 1);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer-link {
  text-align: center;
  margin-top: 1.25rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

.footer-link a {
  color: hsla(160, 100%, 37%, 1);
  text-decoration: none;
}

.footer-link a:hover {
  text-decoration: underline;
}
</style>
