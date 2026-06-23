<script setup>
import { ref, onMounted, watch } from 'vue'
import { apiPost } from '@/api/index.js'

const users = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const keyword = ref('')
const searchKeyword = ref('')

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const data = await apiPost('/v1/admin/users', {
      page: page.value,
      limit: limit.value,
      keyword: searchKeyword.value || undefined,
    })
    users.value = data?.users ?? []
    total.value = data?.total ?? 0
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const totalPages = () => Math.ceil(total.value / limit.value) || 1

function prevPage() {
  if (page.value > 1) {
    page.value--
  }
}

function nextPage() {
  if (page.value < totalPages()) {
    page.value++
  }
}

function onSearch() {
  page.value = 1
  searchKeyword.value = keyword.value.trim()
  fetchUsers()
}

function goToDevices(userId) {
  // navigate to device management with user filter
  const router = getRouter()
  router.push({ name: 'admin-devices', query: { user_id: userId } })
}

// need router
import { useRouter } from 'vue-router'
const router = useRouter()
function getRouter() {
  return router
}

watch(page, () => fetchUsers())

onMounted(fetchUsers)
</script>

<template>
  <main class="user-page">
    <header class="page-header">
      <h1>用户管理</h1>
    </header>

    <!-- 搜索 -->
    <section class="card">
      <div class="search-row">
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索用户名..."
          @keyup.enter="onSearch"
        />
        <button class="btn primary" @click="onSearch">搜索</button>
        <button
          v-if="searchKeyword"
          class="btn"
          @click="keyword = ''; searchKeyword = ''; page = 1; fetchUsers()"
        >
          清除
        </button>
      </div>
    </section>

    <!-- 用户列表 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">用户列表（共 {{ total }} 人）</h2>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="msg error">{{ error }}</div>

      <div v-else class="table-wrap">
        <table v-if="users.length > 0" class="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>角色</th>
              <th>绑定设备数</th>
              <th>电话号码总数</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.user_id">
              <td>{{ u.user_id }}</td>
              <td>{{ u.username }}</td>
              <td>
                <span class="role-tag" :class="u.role">
                  {{ u.role === 'admin' ? '管理员' : '用户' }}
                </span>
              </td>
              <td>{{ u.device_count ?? 0 }}</td>
              <td>{{ u.total_phones ?? 0 }}</td>
              <td class="time">{{ u.created_at ? new Date(u.created_at).toLocaleDateString() : '-' }}</td>
              <td>
                <button class="btn-link" @click="goToDevices(u.user_id)">管理设备</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无用户</div>

        <div v-if="total > limit" class="pagination">
          <button class="btn" :disabled="page <= 1" @click="prevPage">上一页</button>
          <span class="page-info">{{ page }} / {{ totalPages() }}</span>
          <button class="btn" :disabled="page >= totalPages()" @click="nextPage">下一页</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.user-page {
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.6rem;
  margin: 0;
}

.card {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: 1.05rem;
  margin: 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-row input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-row input:focus {
  border-color: hsla(160, 100%, 37%, 1);
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background-color: hsla(160, 100%, 37%, 1);
  border-color: hsla(160, 100%, 37%, 1);
  color: #fff;
}

.btn.primary:not(:disabled):hover {
  background-color: hsla(160, 100%, 32%, 1);
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  font-size: 0.9rem;
  opacity: 0.6;
}

.msg {
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.msg.error {
  background-color: hsla(0, 70%, 50%, 0.1);
  color: hsla(0, 70%, 50%, 1);
  border: 1px solid hsla(0, 70%, 50%, 0.3);
}

.table-wrap {
  overflow-x: auto;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.user-table th,
.user-table td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.user-table thead th {
  background-color: var(--color-background-mute);
  font-weight: 600;
  font-size: 0.82rem;
}

.user-table tbody tr:hover {
  background-color: var(--color-background-mute);
}

.time {
  font-size: 0.82rem;
  opacity: 0.7;
}

.role-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  border: 1px solid var(--color-border);
}

.role-tag.admin {
  border-color: #e6a23c;
  color: #e6a23c;
}

.btn-link {
  background: transparent;
  border: none;
  padding: 0;
  color: hsla(160, 100%, 37%, 1);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.page-info {
  font-size: 0.85rem;
  opacity: 0.7;
}
</style>
