<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiGet } from '@/api/index.js'

const loading = ref(false)
const error = ref('')
const overview = ref(null)

const STATUS_LABELS = { 0: '待拨打', 1: '已拨打', 2: '有意向', 3: '无意向', 4: '号码受限' }
const STATUS_COLORS = { 0: '#909399', 1: '#67c23a', 2: '#e6a23c', 3: '#f56c6c', 4: '#a777d4' }

async function fetchOverview() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await apiGet('/v1/admin/excel/overview')
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const cards = computed(() => {
  if (!overview.value) return []
  return [
    { label: '设备总数', value: overview.value.total_devices ?? 0, color: '#409eff' },
    { label: '电话号码总数', value: overview.value.total_phones ?? 0, color: '#67c23a' },
    { label: '用户数', value: overview.value.total_users ?? 0, color: '#e6a23c' },
    { label: '未绑定设备', value: overview.value.unbound_devices ?? 0, color: '#f56c6c' },
  ]
})

const statusBars = computed(() => {
  if (!overview.value?.phones_by_status) return []
  const statusMap = overview.value.phones_by_status
  return Object.entries(STATUS_LABELS).map(([key, label]) => ({
    label,
    count: statusMap[key] ?? 0,
    color: STATUS_COLORS[key],
  }))
})

const maxStatusCount = computed(() => {
  if (statusBars.value.length === 0) return 1
  return Math.max(...statusBars.value.map((s) => s.count), 1)
})

onMounted(fetchOverview)
</script>

<template>
  <main class="dashboard-page">
    <header class="page-header">
      <h1>概览统计</h1>
    </header>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="overview">
      <section class="cards">
        <div v-for="card in cards" :key="card.label" class="stat-card">
          <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
      </section>

      <section class="status-section card">
        <h2 class="card-title">号码状态分布</h2>
        <div class="status-list">
          <div v-for="bar in statusBars" :key="bar.label" class="status-item">
            <div class="status-label">{{ bar.label }}</div>
            <div class="status-bar-wrap">
              <div
                class="status-bar"
                :style="{
                  width: maxStatusCount ? (bar.count / maxStatusCount) * 100 + '%' : '0%',
                  backgroundColor: bar.color,
                }"
              ></div>
            </div>
            <div class="status-count" :style="{ color: bar.color }">{{ bar.count }}</div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.dashboard-page {
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
  margin: 0;
}

.loading,
.error {
  text-align: center;
  padding: 3rem;
  font-size: 0.95rem;
}

.error {
  color: #f56c6c;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 800px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.25rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  opacity: 0.7;
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

.status-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-label {
  width: 60px;
  font-size: 0.85rem;
  opacity: 0.8;
  flex-shrink: 0;
}

.status-bar-wrap {
  flex: 1;
  height: 24px;
  background-color: var(--color-background-mute);
  border-radius: 4px;
  overflow: hidden;
}

.status-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
  min-width: 4px;
}

.status-count {
  width: 40px;
  text-align: right;
  font-weight: 600;
  font-size: 0.95rem;
  flex-shrink: 0;
}
</style>
