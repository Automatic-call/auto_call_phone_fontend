<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const adminNav = [
  { path: '/admin/overview', label: '概览统计' },
  { path: '/admin/upload', label: '上传管理' },
  { path: '/admin/users', label: '用户管理' },
  { path: '/admin/devices', label: '设备管理' },
]

const clientNav = [
  { path: '/client/phones', label: '拨打电话' },
]

function isActive(path) {
  return route.path === path
}

function handleLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h2>自动打电话</h2>
      </div>

      <nav class="sidebar-nav">
        <div v-if="auth.isAdmin" class="nav-section">
          <div class="nav-section-title">管理后台</div>
          <router-link
            v-for="item in adminNav"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            {{ item.label }}
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">用户端</div>
          <router-link
            v-for="item in clientNav"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            {{ item.label }}
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-avatar">{{ auth.username.charAt(0).toUpperCase() }}</span>
          <span class="user-name">{{ auth.username }}</span>
          <span v-if="auth.role" class="role-tag">{{ auth.role }}</span>
        </div>
        <button class="logout-btn" @click="handleLogout">退出登录</button>
      </div>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background-color: var(--color-background-soft);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-brand {
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-brand h2 {
  font-size: 1.1rem;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.nav-section-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.45;
  padding: 0.4rem 0.85rem 0.2rem;
}

.nav-item {
  display: block;
  padding: 0.6rem 0.85rem;
  border-radius: 6px;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background-color 0.15s;
}

.nav-item:hover {
  background-color: var(--color-background-mute);
}

.nav-item.active {
  background-color: hsla(160, 100%, 37%, 0.12);
  color: hsla(160, 100%, 37%, 1);
  font-weight: 500;
}

.sidebar-footer {
  padding: 0.85rem 1rem;
  border-top: 1px solid var(--color-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: hsla(160, 100%, 37%, 1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
}

.user-name {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  display: inline-block;
  padding: 0 6px;
  border: 1px solid hsla(160, 100%, 37%, 1);
  border-radius: 8px;
  font-size: 0.65rem;
  color: hsla(160, 100%, 37%, 1);
  text-transform: uppercase;
  flex-shrink: 0;
}

.logout-btn {
  width: 100%;
  padding: 0.4rem;
  font-size: 0.82rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.logout-btn:hover {
  background-color: var(--color-background-mute);
}

.main-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .sidebar {
    width: 180px;
  }
}
</style>
