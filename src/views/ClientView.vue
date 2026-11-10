<script setup>
import { ref, onMounted } from 'vue'
import { apiGet, apiPost } from '@/api/index.js'

const STATUS_MAP = {
  0: { text: '待拨打', color: '#909399' },
  1: { text: '已拨打', color: '#67c23a' },
  2: { text: '有意向', color: '#e6a23c' },
  3: { text: '无意向', color: '#f56c6c' },
}

const deviceId = ref('')
const registerDeviceId = ref('')
const devices = ref([])
const phones = ref([])
const phoneStatuses = ref({})

const isLoadingDevices = ref(false)
const isRegistering = ref(false)
const isFetchingPhones = ref(false)
const updatingPhone = ref(null)
const message = ref(null)

function showMessage(type, text) {
  message.value = { type, text }
}

function clearMessage() {
  message.value = null
}

function statusInfo(status) {
  return STATUS_MAP[status] || { text: `未知(${status})`, color: '#909399' }
}

async function fetchDevices() {
  isLoadingDevices.value = true
  try {
    const data = await apiGet('/v1/client/auth/devices')
    devices.value = data?.devices ?? []
  } catch (err) {
    showMessage('error', `获取设备列表失败：${err.message}`)
  } finally {
    isLoadingDevices.value = false
  }
}

async function registerDevice() {
  const id = registerDeviceId.value.trim()
  if (!id) {
    showMessage('error', '请输入设备 ID')
    return
  }
  isRegistering.value = true
  clearMessage()
  try {
    const data = await apiPost('/v1/client/excel/register_device', { device_id: id })
    showMessage('success', data.created ? '设备注册成功' : '设备已存在，无需重复注册')
    registerDeviceId.value = ''
    deviceId.value = id
    await fetchDevices()
    await fetchPhones()
  } catch (err) {
    showMessage('error', `注册失败：${err.message}`)
  } finally {
    isRegistering.value = false
  }
}

async function fetchPhones() {
  if (!deviceId.value.trim()) {
    showMessage('error', '请先选择或注册设备')
    return
  }
  isFetchingPhones.value = true
  clearMessage()
  try {
    const data = await apiPost('/v1/client/excel/get_client_phone', {
      device_id: deviceId.value.trim(),
    })
    phones.value = data?.phones ?? []
    phoneStatuses.value = {}
    if (phones.value.length === 0) {
      showMessage('success', '暂无待处理号码')
    } else {
      showMessage('success', `已加载 ${phones.value.length} 个号码`)
    }
  } catch (err) {
    showMessage('error', `获取号码失败：${err.message}`)
  } finally {
    isFetchingPhones.value = false
  }
}

async function updateStatus(phoneNumber, status) {
  if (updatingPhone.value) return
  updatingPhone.value = phoneNumber
  clearMessage()
  try {
    const data = await apiPost('/v1/client/excel/update_phone_status', {
      phone_number: phoneNumber,
      status,
      device_id: deviceId.value.trim() || undefined,
    })
    phoneStatuses.value[phoneNumber] = data?.status ?? status
    showMessage('success', `号码 ${phoneNumber} 已更新为「${statusInfo(data?.status ?? status).text}」`)
  } catch (err) {
    showMessage('error', `更新失败：${err.message}`)
  } finally {
    updatingPhone.value = null
  }
}

function effectiveStatus(phoneNumber) {
  if (phoneNumber in phoneStatuses.value) {
    return phoneStatuses.value[phoneNumber]
  }
  return 0
}

onMounted(() => {
  fetchDevices()
})
</script>

<template>
  <main class="client-page">
    <header class="page-header">
      <h1>拨打电话</h1>
      <p class="hint">选择设备后获取待处理号码，逐一拨打电话并更新状态</p>
    </header>

    <!-- 设备区域 -->
    <section class="device-section">
      <div class="card">
        <h2 class="card-title">我的设备</h2>

        <div class="device-list" v-if="devices.length > 0">
          <label
            v-for="d in devices"
            :key="d"
            class="device-radio"
            :class="{ checked: deviceId === d }"
          >
            <input type="radio" v-model="deviceId" :value="d" @change="fetchPhones" />
            <span class="device-id">{{ d }}</span>
          </label>
        </div>
        <div v-else-if="!isLoadingDevices" class="empty-hint">
          暂无已注册设备，请在下方注册
        </div>

        <div class="register-row">
          <input
            v-model="registerDeviceId"
            type="text"
            placeholder="输入新设备 ID"
            :disabled="isRegistering"
            @keyup.enter="registerDevice"
          />
          <button class="btn primary" :disabled="isRegistering || !registerDeviceId.trim()" @click="registerDevice">
            {{ isRegistering ? '注册中...' : '注册设备' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 号码列表 -->
    <section class="phone-section">
      <div class="card">
        <div class="card-head">
          <h2 class="card-title">待处理号码</h2>
          <button
            class="btn"
            :disabled="isFetchingPhones || !deviceId.trim()"
            @click="fetchPhones"
          >
            {{ isFetchingPhones ? '加载中...' : '刷新列表' }}
          </button>
        </div>

        <div v-if="message" class="message" :class="message.type">
          {{ message.text }}
        </div>

        <div v-if="phones.length > 0" class="phone-grid">
          <div
            v-for="phone in phones"
            :key="phone.phone_number"
            class="phone-card"
            :class="{ updated: phone.phone_number in phoneStatuses }"
          >
            <div class="phone-info">
              <div class="phone-number">{{ phone.phone_number }}</div>
              <div v-if="phone.company_name" class="company-name">{{ phone.company_name }}</div>
            </div>
            <div class="phone-status">
              <span
                class="status-tag"
                :style="{
                  color: statusInfo(effectiveStatus(phone.phone_number)).color,
                  borderColor: statusInfo(effectiveStatus(phone.phone_number)).color,
                }"
              >
                {{ statusInfo(effectiveStatus(phone.phone_number)).text }}
              </span>
            </div>
            <div class="phone-actions">
              <button
                class="action-btn done"
                :disabled="updatingPhone !== null"
                @click="updateStatus(phone.phone_number, 1)"
              >
                已拨打
              </button>
              <button
                class="action-btn interested"
                :disabled="updatingPhone !== null"
                @click="updateStatus(phone.phone_number, 2)"
              >
                有意向
              </button>
              <button
                class="action-btn not-interested"
                :disabled="updatingPhone !== null"
                @click="updateStatus(phone.phone_number, 3)"
              >
                无意向
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!message" class="empty">
          <div class="empty-icon">📞</div>
          <div>暂无号码</div>
          <div class="secondary-text">选择设备后点击「刷新列表」获取待处理号码</div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.client-page {
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.6rem;
  margin: 0 0 0.25rem;
}

.hint {
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.875rem;
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
  margin: 0 0 1rem;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.card-head .card-title {
  margin: 0;
}

.device-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.device-radio {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
  font-size: 0.9rem;
}

.device-radio:hover {
  border-color: hsla(160, 100%, 37%, 0.5);
}

.device-radio.checked {
  border-color: hsla(160, 100%, 37%, 1);
  background-color: hsla(160, 100%, 37%, 0.06);
}

.device-radio input {
  display: none;
}

.device-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.empty-hint {
  font-size: 0.85rem;
  opacity: 0.5;
  margin-bottom: 1rem;
}

.register-row {
  display: flex;
  gap: 0.5rem;
}

.register-row input {
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

.register-row input:focus {
  border-color: hsla(160, 100%, 37%, 1);
}

.register-row input:disabled {
  opacity: 0.5;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s, background-color 0.2s;
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

.message {
  margin-bottom: 1rem;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.message.success {
  background-color: hsla(160, 100%, 37%, 0.1);
  color: hsla(160, 100%, 37%, 1);
  border: 1px solid hsla(160, 100%, 37%, 0.3);
}

.message.error {
  background-color: hsla(0, 70%, 50%, 0.1);
  color: hsla(0, 70%, 50%, 1);
  border: 1px solid hsla(0, 70%, 50%, 0.3);
}

.phone-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.phone-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-background);
  transition: border-color 0.2s;
}

.phone-card.updated {
  opacity: 0.5;
}

.phone-info {
  flex: 1;
  min-width: 0;
}

.phone-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1.05rem;
  font-weight: 500;
}

.company-name {
  font-size: 0.85rem;
  opacity: 0.7;
  overflow-wrap: anywhere;
}

.phone-status {
  min-width: 72px;
  text-align: center;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 10px;
  font-size: 0.78rem;
}

.phone-actions {
  display: flex;
  gap: 0.4rem;
}

.action-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.done:not(:disabled):hover {
  border-color: #67c23a;
  color: #67c23a;
}

.action-btn.interested:not(:disabled):hover {
  border-color: #e6a23c;
  color: #e6a23c;
}

.action-btn.not-interested:not(:disabled):hover {
  border-color: #f56c6c;
  color: #f56c6c;
}

.empty {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--color-text);
  opacity: 0.6;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.secondary-text {
  font-size: 0.8rem;
  opacity: 0.6;
}
</style>
