<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { apiPost } from '@/api/index.js'

const route = useRoute()

const devices = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const boundCount = ref(0)
const unboundCount = ref(0)
const statusFilter = ref('all')

const bindingDeviceId = ref('')
const bindingUserId = ref('')
const users = ref([])
const isLoadingUsers = ref(false)
const isBinding = ref(false)
const bindError = ref('')
const bindSuccess = ref('')

const unbindingId = ref(null)

async function fetchUsers() {
  isLoadingUsers.value = true
  try {
    const availableUsers = []
    let userPage = 1
    let userTotal = 0
    do {
      const data = await apiPost('/v1/admin/users', { page: userPage, limit: 100 })
      availableUsers.push(...(data?.users ?? []))
      userTotal = data?.total ?? 0
      userPage++
    } while (availableUsers.length < userTotal)
    users.value = availableUsers
  } catch (err) {
    bindError.value = `获取用户列表失败：${err.message}`
  } finally {
    isLoadingUsers.value = false
  }
}

async function fetchDevices() {
  loading.value = true
  error.value = ''
  try {
    const data = await apiPost('/v1/admin/devices', {
      page: page.value,
      limit: limit.value,
      status: statusFilter.value,
    })
    devices.value = data?.devices ?? []
    total.value = data?.total ?? 0
    boundCount.value = data?.bound ?? 0
    unboundCount.value = data?.unbound ?? 0
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const totalPages = () => Math.ceil(total.value / limit.value) || 1

function prevPage() {
  if (page.value > 1) page.value--
}

function nextPage() {
  if (page.value < totalPages()) page.value++
}

function startBinding(deviceId) {
  bindingDeviceId.value = deviceId
  bindingUserId.value = route.query.user_id ? String(route.query.user_id) : ''
  bindError.value = ''
  bindSuccess.value = ''
}

async function bindDevice(deviceId) {
  if (!bindingUserId.value || isBinding.value) return
  isBinding.value = true
  bindError.value = ''
  bindSuccess.value = ''
  try {
    await apiPost('/v1/admin/excel/bind_device', {
      device_id: deviceId,
      user_id: Number(bindingUserId.value),
    })
    bindSuccess.value = `设备 ${deviceId} 绑定成功`
    bindingDeviceId.value = ''
    bindingUserId.value = ''
    await fetchDevices()
  } catch (err) {
    bindError.value = err.message || '绑定失败'
  } finally {
    isBinding.value = false
  }
}

async function unbindDevice(deviceId) {
  if (unbindingId.value) return
  if (!window.confirm(`确认解绑设备 ${deviceId} 吗？`)) return
  unbindingId.value = deviceId
  try {
    await apiPost('/v1/admin/devices/unbind', { device_id: deviceId })
    await fetchDevices()
  } catch (err) {
    error.value = err.message || '解绑失败'
  } finally {
    unbindingId.value = null
  }
}

function isUnbound(d) {
  return !d.user_id && !d.username
}

onMounted(() => {
  fetchDevices()
  fetchUsers()
})

watch(page, () => fetchDevices())
watch(statusFilter, () => {
  page.value = 1
  fetchDevices()
})
</script>

<template>
  <main class="device-page">
    <header class="page-header">
      <h1>设备管理</h1>
    </header>

    <!-- 设备列表 -->
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">设备列表</h2>
        <div class="filter-tabs">
          <button
            class="tab"
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >
            全部 ({{ total }})
          </button>
          <button
            class="tab"
            :class="{ active: statusFilter === 'bound' }"
            @click="statusFilter = 'bound'"
          >
            已分配 ({{ boundCount }})
          </button>
          <button
            class="tab"
            :class="{ active: statusFilter === 'unbound' }"
            @click="statusFilter = 'unbound'"
          >
            未分配 ({{ unboundCount }})
          </button>
        </div>
      </div>

      <div v-if="bindError" class="msg error">{{ bindError }}</div>
      <div v-if="bindSuccess" class="msg success">{{ bindSuccess }}</div>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="msg error">{{ error }}</div>

      <div v-else class="table-wrap">
        <table v-if="devices.length > 0" class="device-table">
          <thead>
            <tr>
              <th>设备 ID</th>
              <th>绑定用户</th>
              <th>总号码</th>
              <th>待拨打</th>
              <th>已拨打</th>
              <th>有意向</th>
              <th>无意向</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in devices" :key="d.device_id" :class="{ unbound: isUnbound(d) }">
              <td class="mono">{{ d.device_id }}</td>
              <td>
                <template v-if="isUnbound(d)">
                  <span class="unbound-tag">未绑定</span>
                </template>
                <template v-else>
                  {{ d.username || '-' }}
                  <span class="uid">(#{{ d.user_id }})</span>
                </template>
              </td>
              <td>{{ d.total_phones ?? 0 }}</td>
              <td>{{ d.pending_count ?? 0 }}</td>
              <td>{{ d.called_count ?? 0 }}</td>
              <td class="interested">{{ d.interested_count ?? 0 }}</td>
              <td class="not-interested">{{ d.not_interested_count ?? 0 }}</td>
              <td class="time">{{ d.created_at ? new Date(d.created_at).toLocaleDateString() : '-' }}</td>
              <td>
                <template v-if="isUnbound(d)">
                  <div v-if="bindingDeviceId === d.device_id" class="row-bind">
                    <select v-model="bindingUserId" :disabled="isLoadingUsers || isBinding">
                      <option value="" disabled>{{ isLoadingUsers ? '加载用户中...' : '请选择用户' }}</option>
                      <option v-for="user in users" :key="user.user_id" :value="String(user.user_id)">
                        {{ user.username }}（{{ user.role === 'admin' ? '管理员' : '普通用户' }}，#{{ user.user_id }}）
                      </option>
                    </select>
                    <button class="btn-link" :disabled="!bindingUserId || isBinding" @click="bindDevice(d.device_id)">
                      {{ isBinding ? '绑定中...' : '确认' }}
                    </button>
                    <button class="btn-link" :disabled="isBinding" @click="bindingDeviceId = ''">取消</button>
                  </div>
                  <button v-else class="btn-link" :disabled="isLoadingUsers || isBinding" @click="startBinding(d.device_id)">
                    绑定
                  </button>
                </template>
                <button
                  v-else
                  class="btn-link danger"
                  :disabled="unbindingId === d.device_id"
                  @click="unbindDevice(d.device_id)"
                >
                  {{ unbindingId === d.device_id ? '解绑中...' : '解绑' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无设备数据</div>

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
.device-page {
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
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.tab {
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.tab.active {
  background-color: hsla(160, 100%, 37%, 0.12);
  border-color: hsla(160, 100%, 37%, 1);
  color: hsla(160, 100%, 37%, 1);
  font-weight: 500;
}

.row-bind {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.row-bind select {
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
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

.msg {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.msg.success {
  background-color: hsla(160, 100%, 37%, 0.1);
  color: hsla(160, 100%, 37%, 1);
  border: 1px solid hsla(160, 100%, 37%, 0.3);
}

.msg.error {
  background-color: hsla(0, 70%, 50%, 0.1);
  color: hsla(0, 70%, 50%, 1);
  border: 1px solid hsla(0, 70%, 50%, 0.3);
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  font-size: 0.9rem;
  opacity: 0.6;
}

.table-wrap {
  overflow-x: auto;
}

.device-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.device-table th,
.device-table td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.device-table thead th {
  background-color: var(--color-background-mute);
  font-weight: 600;
  font-size: 0.82rem;
  white-space: nowrap;
}

.device-table tbody tr:hover {
  background-color: var(--color-background-mute);
}

.device-table tbody tr.unbound {
  opacity: 0.5;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.unbound-tag {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid #909399;
  border-radius: 10px;
  font-size: 0.75rem;
  color: #909399;
}

.uid {
  font-size: 0.78rem;
  opacity: 0.5;
  margin-left: 0.25rem;
}

.time {
  font-size: 0.82rem;
  opacity: 0.7;
  white-space: nowrap;
}

.interested {
  color: #e6a23c;
  font-weight: 500;
}

.not-interested {
  color: #f56c6c;
  font-weight: 500;
}

.btn-link {
  background: transparent;
  border: none;
  padding: 0;
  color: hsla(160, 100%, 37%, 1);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-link.danger {
  color: #f56c6c;
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
