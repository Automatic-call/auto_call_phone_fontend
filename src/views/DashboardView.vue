<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiGet } from '@/api/index.js'

const loading = ref(false)
const error = ref('')
const overview = ref(null)
const selectedUserId = ref('')

const STATUS_LABELS = { 0: '待拨打', 1: '已拨打', 2: '有意向', 3: '无意向', 4: '号码受限' }
const STATUS_COLORS = { 0: '#909399', 1: '#67c23a', 2: '#e6a23c', 3: '#f56c6c', 4: '#a777d4' }

async function fetchOverview() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await apiGet('/v1/admin/excel/overview')
    if (!selectedUserId.value && overview.value.weekly_user_calls?.length) {
      selectedUserId.value = String(overview.value.weekly_user_calls[0].user_id)
    }
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

const weeklyPhones = computed(() => overview.value?.weekly_phones ?? [])
const weeklyUsers = computed(() => overview.value?.weekly_user_calls ?? [])
const selectedUser = computed(() => weeklyUsers.value.find((user) => String(user.user_id) === selectedUserId.value))
const userDays = computed(() => {
  if (!selectedUser.value) return []
  const byDate = new Map(selectedUser.value.days.map((day) => [day.date, day.count]))
  return weeklyPhones.value.map((day) => ({ date: day.date, count: byDate.get(day.date) ?? 0 }))
})
const chartWidth = 640
const chartHeight = 220
const chartPadding = 30
const chartTop = 16
const chartBottom = chartHeight - 28

function chartPoints(key) {
  const rows = weeklyPhones.value
  if (!rows.length) return ''
  const max = Math.max(...rows.map((row) => row[key]), 1)
  return rows.map((row, index) => {
    const x = chartPadding + (index * (chartWidth - 2 * chartPadding)) / 6
    const y = chartBottom - (row[key] / max) * (chartBottom - chartTop)
    return `${x},${y}`
  }).join(' ')
}

function userCallPoints() {
  const rows = userDays.value
  if (!rows.length) return ''
  const max = Math.max(...rows.map((row) => row.count), 1)
  return rows.map((row, index) => {
    const x = chartPadding + (index * (chartWidth - 2 * chartPadding)) / 6
    const y = chartBottom - (row.count / max) * (chartBottom - chartTop)
    return `${x},${y}`
  }).join(' ')
}

function dateLabel(date) {
  return date?.slice(5) ?? ''
}

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

      <section class="trend-section card">
        <h2 class="card-title">本周号码趋势（周一至周日）</h2>
        <p class="chart-hint">新增号码按创建日期统计；累计号码为截至当天当前未删除的号码数。两条曲线分别按自身最大值缩放，具体数量见下方。</p>
        <div v-if="weeklyPhones.length" class="trend-chart">
          <div class="chart-legend">
            <span class="legend-new">● 每日新增</span>
            <span class="legend-total">● 累计号码</span>
          </div>
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img" aria-label="本周每日新增与累计号码趋势折线图">
            <line :x1="chartPadding" :x2="chartWidth - chartPadding" :y1="chartBottom" :y2="chartBottom" stroke="#b9c0c6" />
            <polyline :points="chartPoints('new_count')" fill="none" stroke="#409eff" stroke-width="2.5" stroke-linejoin="round" />
            <polyline :points="chartPoints('cumulative')" fill="none" stroke="#67c23a" stroke-width="2.5" stroke-linejoin="round" />
          </svg>
          <div class="day-values">
            <div v-for="day in weeklyPhones" :key="day.date" class="day-value">
              <b>{{ dateLabel(day.date) }}</b>
              <span class="legend-new">新增 {{ day.new_count }}</span>
              <span class="legend-total">累计 {{ day.cumulative }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-trend">暂无趋势数据</div>
      </section>

      <section class="trend-section card">
        <div class="user-trend-head">
          <h2 class="card-title">本周用户每日处理号码趋势</h2>
          <select v-model="selectedUserId" aria-label="选择用户">
            <option v-for="user in weeklyUsers" :key="user.user_id" :value="String(user.user_id)">
              {{ user.username }} (#{{ user.user_id }})
            </option>
          </select>
        </div>
        <p class="chart-hint">近似值：按号码当前已处理状态及最后更新时间统计，并归属当前绑定的用户；改备注或设备换绑会改变统计，不代表实际拨打次数。</p>
        <div v-if="selectedUser" class="trend-chart">
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img" :aria-label="`${selectedUser.username} 本周每日处理号码趋势`">
            <line :x1="chartPadding" :x2="chartWidth - chartPadding" :y1="chartBottom" :y2="chartBottom" stroke="#b9c0c6" />
            <polyline :points="userCallPoints()" fill="none" stroke="#409eff" stroke-width="2.5" stroke-linejoin="round" />
          </svg>
          <div class="day-values">
            <div v-for="day in userDays" :key="day.date" class="day-value">
              <b>{{ dateLabel(day.date) }}</b>
              <span class="legend-new">{{ day.count }} 条</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-trend">本周暂无用户处理记录</div>
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

.user-trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.user-trend-head .card-title {
  margin: 0;
}

.user-trend-head select {
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
}

.chart-hint {
  font-size: 0.82rem;
  opacity: 0.7;
  margin: 0.6rem 0 1rem;
}

.trend-chart svg {
  display: block;
  width: 100%;
  height: auto;
}

.chart-legend {
  display: flex;
  gap: 1.25rem;
  font-size: 0.85rem;
}

.legend-new {
  color: #409eff;
}

.legend-total {
  color: #67c23a;
}

.day-values {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.day-value {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.8rem;
  white-space: nowrap;
}

.empty-trend {
  padding: 2rem;
  text-align: center;
  opacity: 0.6;
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
