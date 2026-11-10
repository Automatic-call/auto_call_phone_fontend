<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiUrl } from '@/config.js'
import { apiGet, apiPost } from '@/api/index.js'
import { useAuthStore } from '@/stores/auth.js'

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']
const MAX_SIZE_MB = 10
const auth = useAuthStore()
const isAdmin = computed(() => auth.isAdmin)
const UPLOAD_URL = computed(() =>
  apiUrl(isAdmin.value ? '/v1/admin/excel/upload_excel' : '/v1/client/excel/upload_excel'),
)

const STATUS_MAP = {
  0: { text: '待拨打', color: '#909399' },
  1: { text: '已拨打', color: '#67c23a' },
  2: { text: '有意向', color: '#e6a23c' },
  3: { text: '无意向', color: '#f56c6c' },
}

const fileInput = ref(null)
const selectedFile = ref(null)
const isDragging = ref(false)
const isUploading = ref(false)
const isFetching = ref(false)
const progress = ref(0)
const message = ref(null)

const deviceId = ref('')
const deviceList = ref([])
const isLoadingDevices = ref(false)

const phoneList = ref([])
const stats = ref({ total: 0, effective: 0, repeat: 0 })

const editingId = ref(null)
const editingRemark = ref('')
const editingStatus = ref(0)
const isSavingEdit = ref(false)
const deletingId = ref(null)

const fileSizeText = computed(() => {
  if (!selectedFile.value) return ''
  const kb = selectedFile.value.size / 1024
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`
})

function showMessage(type, text) {
  message.value = { type, text }
}

function clearMessage() {
  message.value = null
}

function statusInfo(status) {
  return STATUS_MAP[status] || { text: `未知(${status})`, color: '#909399' }
}

function validateFile(file) {
  const lower = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    showMessage('error', `仅支持 ${ACCEPTED_EXTENSIONS.join(' / ')} 格式`)
    return false
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    showMessage('error', `文件大小不能超过 ${MAX_SIZE_MB} MB`)
    return false
  }
  return true
}

function setFile(file) {
  clearMessage()
  if (!file) return
  if (!validateFile(file)) {
    selectedFile.value = null
    return
  }
  selectedFile.value = file
  progress.value = 0
}

function onPick() {
  fileInput.value?.click()
}

function onFileChange(e) {
  setFile(e.target.files?.[0])
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  setFile(e.dataTransfer.files?.[0])
}

function reset() {
  selectedFile.value = null
  progress.value = 0
  clearMessage()
}

function upload() {
  if (!selectedFile.value || isUploading.value) return
  if (!deviceId.value.trim()) {
    showMessage('error', '请选择设备')
    return
  }
  clearMessage()
  isUploading.value = true
  progress.value = 0

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('device_id', deviceId.value.trim())
  const xhr = new XMLHttpRequest()
  xhr.open('POST', UPLOAD_URL.value)

  const token = localStorage.getItem('token')
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      progress.value = Math.round((event.loaded / event.total) * 100)
    }
  }

  xhr.onload = () => {
    isUploading.value = false
    if (xhr.status >= 200 && xhr.status < 300) {
      progress.value = 100
      try {
        const data = JSON.parse(xhr.responseText)
        applyResult(data)
        showMessage(
          'success',
          `上传成功：共 ${data.total ?? 0} 条，有效 ${data.effective_count ?? 0}，重复 ${data.repeat_count ?? 0}`,
        )
        selectedFile.value = null
        if (isAdmin.value) fetchPhones()
      } catch {
        showMessage('error', '上传成功，但响应解析失败')
      }
    } else {
      showMessage('error', `上传失败（${xhr.status}）：${xhr.responseText || '服务器错误'}`)
    }
  }

  xhr.onerror = () => {
    isUploading.value = false
    showMessage('error', '网络错误，上传失败')
  }

  xhr.send(formData)
}

function applyResult(data) {
  phoneList.value = data?.phone_list ?? []
  stats.value = {
    total: data?.total ?? 0,
    effective: data?.effective_count ?? 0,
    repeat: data?.repeat_count ?? 0,
  }
}

async function fetchPhones() {
  if (!deviceId.value.trim()) {
    showMessage('error', '请选择设备')
    return
  }
  isFetching.value = true
  clearMessage()
  try {
    const data = await apiPost(
      isAdmin.value ? '/v1/admin/excel/get_phones' : '/v1/client/excel/get_phones',
      { device_id: deviceId.value.trim() },
    )
    phoneList.value = data?.phone_list ?? []
    stats.value = {
      total: data?.total ?? 0,
      effective: stats.value.effective,
      repeat: stats.value.repeat,
    }
    showMessage('success', `已加载 ${data?.total ?? 0} 条记录`)
  } catch (err) {
    showMessage('error', `加载失败：${err.message}`)
  } finally {
    isFetching.value = false
  }
}

function startEdit(item) {
  editingId.value = item.id
  editingRemark.value = item.remark ?? ''
  editingStatus.value = item.status ?? 0
}

function cancelEdit() {
  editingId.value = null
  editingRemark.value = ''
  editingStatus.value = 0
}

async function saveEdit(item) {
  if (isSavingEdit.value) return
  isSavingEdit.value = true
  clearMessage()
  try {
    const data = await apiPost(isAdmin.value ? '/v1/admin/excel/update_phone' : '/v1/client/excel/update_phone', {
      id: item.id,
      remark: editingRemark.value,
      status: Number(editingStatus.value),
    })
    const idx = phoneList.value.findIndex((p) => p.id === item.id)
    if (idx !== -1) {
      phoneList.value[idx] = {
        ...phoneList.value[idx],
        phone_number: data?.phone_number ?? phoneList.value[idx].phone_number,
        remark: data?.remark ?? '',
        status: data?.status ?? phoneList.value[idx].status,
      }
    }
    cancelEdit()
    showMessage('success', '保存成功')
  } catch (err) {
    showMessage('error', `保存失败：${err.message}`)
  } finally {
    isSavingEdit.value = false
  }
}

async function removePhone(item) {
  if (deletingId.value !== null) return
  if (!window.confirm(`确认删除号码 ${item.phone_number} 吗？`)) return
  deletingId.value = item.id
  clearMessage()
  try {
    await apiPost(isAdmin.value ? '/v1/admin/excel/delete_phone' : '/v1/client/excel/delete_phone', { id: item.id })
    phoneList.value = phoneList.value.filter((p) => p.id !== item.id)
    stats.value = { ...stats.value, total: Math.max(0, stats.value.total - 1) }
    if (editingId.value === item.id) cancelEdit()
    showMessage('success', '删除成功')
  } catch (err) {
    showMessage('error', `删除失败：${err.message}`)
  } finally {
    deletingId.value = null
  }
}

async function fetchDevices() {
  isLoadingDevices.value = true
  try {
    if (isAdmin.value) {
      const data = await apiPost('/v1/admin/excel/get_devices', {})
      deviceList.value = data?.device_list ?? []
    } else {
      const data = await apiGet('/v1/client/auth/devices')
      deviceList.value = data?.devices ?? []
    }
  } catch (err) {
    showMessage('error', `获取设备列表失败：${err.message}`)
  } finally {
    isLoadingDevices.value = false
  }
}

onMounted(() => {
  fetchDevices()
})
</script>

<template>
  <main class="upload-page">
    <header class="page-header">
      <h1>电话号码 Excel 上传</h1>
      <p class="hint">{{ isAdmin ? '左侧上传 Excel 文件，右侧实时预览号码列表' : '将号码上传到自己绑定的设备' }}</p>
    </header>

    <div class="layout">
      <!-- 左侧：上传区 -->
      <section class="panel left">
        <h2 class="panel-title">上传</h2>

        <div class="form-row">
          <label>设备 ID <span class="required">*</span></label>
          <select v-model="deviceId" :disabled="isLoadingDevices">
            <option value="" disabled>{{ isLoadingDevices ? '加载中...' : '请选择设备' }}</option>
            <option v-for="device in deviceList" :key="device" :value="device">
              {{ device }}
            </option>
          </select>
        </div>

        <div
          class="dropzone"
          :class="{ dragging: isDragging, 'has-file': selectedFile }"
          @click="onPick"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            :accept="ACCEPTED_EXTENSIONS.join(',')"
            class="file-input"
            @change="onFileChange"
          />

          <template v-if="!selectedFile">
            <div class="icon">⬆</div>
            <div class="primary-text">点击或拖拽文件到此处</div>
            <div class="secondary-text">
              支持 {{ ACCEPTED_EXTENSIONS.join(' / ') }}，≤ {{ MAX_SIZE_MB }}MB
            </div>
          </template>

          <template v-else>
            <div class="file-info">
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-meta">{{ fileSizeText }}</div>
            </div>
          </template>
        </div>

        <div v-if="isUploading || progress > 0" class="progress">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
          <span class="progress-text">{{ progress }}%</span>
        </div>

        <div v-if="message" class="message" :class="message.type">
          {{ message.text }}
        </div>

        <div class="actions">
          <button class="btn" :disabled="!selectedFile || isUploading" @click="reset">
            重置
          </button>
          <button v-if="isAdmin" class="btn ghost" :disabled="isFetching || isUploading" @click="fetchPhones">
            {{ isFetching ? '加载中...' : '加载已有号码' }}
          </button>
          <button
            class="btn primary"
            :disabled="!selectedFile || isUploading"
            @click="upload"
          >
            {{ isUploading ? '上传中...' : '开始上传' }}
          </button>
        </div>
      </section>

      <!-- 右侧：预览区 -->
      <section class="panel right">
        <div class="panel-head">
          <h2 class="panel-title">{{ isAdmin ? '预览' : '上传结果' }}</h2>
          <div class="stats">
            <span class="stat">
              总计 <b>{{ stats.total }}</b>
            </span>
            <span class="stat success">
              有效 <b>{{ stats.effective }}</b>
            </span>
            <span class="stat warning">
              重复 <b>{{ stats.repeat }}</b>
            </span>
          </div>
        </div>

        <div class="table-wrap">
          <table v-if="phoneList.length > 0" class="phone-table">
            <thead>
              <tr>
                <th class="col-idx">#</th>
                <th>电话号码</th>
                <th class="col-status">状态</th>
                <th>备注</th>
                <th v-if="isAdmin" class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in phoneList" :key="item.id ?? idx">
                <td class="col-idx">{{ idx + 1 }}</td>
                <td class="phone">{{ item.phone_number }}</td>
                <td class="col-status">
                  <template v-if="isAdmin && editingId === item.id">
                    <select v-model.number="editingStatus" class="edit-input">
                      <option :value="0">待拨打</option>
                      <option :value="1">已拨打</option>
                      <option :value="2">有意向</option>
                      <option :value="3">无意向</option>
                    </select>
                  </template>
                  <template v-else>
                    <span
                      class="status-tag"
                      :style="{
                        color: statusInfo(item.status).color,
                        borderColor: statusInfo(item.status).color,
                      }"
                    >
                      {{ statusInfo(item.status).text }}
                    </span>
                  </template>
                </td>
                <td class="remark">
                  <input
                    v-if="isAdmin && editingId === item.id"
                    v-model="editingRemark"
                    type="text"
                    class="edit-input"
                    placeholder="备注"
                  />
                  <template v-else>{{ item.remark || '-' }}</template>
                </td>
                <td v-if="isAdmin" class="col-actions">
                  <template v-if="editingId === item.id">
                    <button
                      class="btn-link"
                      :disabled="isSavingEdit"
                      @click="saveEdit(item)"
                    >
                      {{ isSavingEdit ? '保存中...' : '保存' }}
                    </button>
                    <button
                      class="btn-link cancel"
                      :disabled="isSavingEdit"
                      @click="cancelEdit"
                    >
                      取消
                    </button>
                  </template>
                  <template v-else>
                    <button
                      class="btn-link"
                      :disabled="editingId !== null || deletingId !== null"
                      @click="startEdit(item)"
                    >
                      编辑
                    </button>
                    <button
                      class="btn-link danger"
                      :disabled="editingId !== null || deletingId !== null"
                      @click="removePhone(item)"
                    >
                      {{ deletingId === item.id ? '删除中...' : '删除' }}
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="empty">
            <div class="empty-icon">📋</div>
            <div>暂无数据</div>
            <div class="secondary-text">上传 Excel 或加载已有号码后在此预览</div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.upload-page {
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  max-width: 1600px;
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

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.panel {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
}

.panel.right {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 6rem);
  min-height: 0;
}

.panel-title {
  font-size: 1.05rem;
  margin: 0 0 1rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.panel-head .panel-title {
  margin: 0;
}

.stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.stat b {
  font-size: 1rem;
  margin-left: 0.25rem;
}

.stat.success b {
  color: hsla(160, 100%, 37%, 1);
}

.stat.warning b {
  color: #e6a23c;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.form-row label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.required {
  color: #f56c6c;
}

.hint-label {
  font-size: 0.78rem;
  opacity: 0.5;
}

.form-row input,
.form-row select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-row input:focus,
.form-row select:focus {
  border-color: hsla(160, 100%, 37%, 1);
}

.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 1.75rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  background-color: var(--color-background);
  margin-top: 0.25rem;
}

.dropzone:hover,
.dropzone.dragging {
  border-color: hsla(160, 100%, 37%, 1);
  background-color: var(--color-background-mute);
}

.dropzone.has-file {
  border-style: solid;
}

.file-input {
  display: none;
}

.icon {
  font-size: 2rem;
  color: hsla(160, 100%, 37%, 1);
  margin-bottom: 0.4rem;
}

.primary-text {
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.secondary-text {
  font-size: 0.8rem;
  opacity: 0.6;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 600;
  word-break: break-all;
}

.file-meta {
  font-size: 0.85rem;
  opacity: 0.7;
}

.progress {
  position: relative;
  height: 8px;
  background-color: var(--color-background-mute);
  border-radius: 4px;
  margin-top: 1rem;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: hsla(160, 100%, 37%, 1);
  transition: width 0.2s;
}

.progress-text {
  position: absolute;
  right: 0;
  top: 12px;
  font-size: 0.75rem;
  opacity: 0.7;
}

.message {
  margin-top: 1rem;
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

.actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
  flex-wrap: wrap;
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
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
}

.btn.primary {
  background-color: hsla(160, 100%, 37%, 1);
  border-color: hsla(160, 100%, 37%, 1);
  color: #fff;
}

.btn.primary:not(:disabled):hover {
  background-color: hsla(160, 100%, 32%, 1);
}

.table-wrap {
  flex: 1;
  min-height: 0;
  max-height: 70vh;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.phone-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.phone-table th,
.phone-table td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.phone-table thead th {
  background-color: var(--color-background-mute);
  position: sticky;
  top: 0;
  font-weight: 600;
  font-size: 0.82rem;
}

.phone-table tbody tr:hover {
  background-color: var(--color-background-mute);
}

.col-idx {
  width: 56px;
  color: var(--color-text);
  opacity: 0.6;
}

.col-status {
  width: 90px;
}

.col-actions {
  width: 140px;
  white-space: nowrap;
}

.edit-input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-background);
  color: var(--color-text);
  border-radius: 4px;
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
}

.edit-input:focus {
  border-color: hsla(160, 100%, 37%, 1);
}

.btn-link {
  background: transparent;
  border: none;
  padding: 0 0.35rem;
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

.btn-link.cancel {
  color: var(--color-text);
  opacity: 0.7;
}

.phone {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.remark {
  opacity: 0.85;
}

.status-tag {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 10px;
  font-size: 0.75rem;
  background-color: transparent;
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
</style>
