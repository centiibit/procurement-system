<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import '@/assets/dashboard.css'
import '@/assets/reports.css' // <-- Imported your new CSS file here!

const authStore = useAuthStore()
const requestStore = useRequestStore()

// --- DATE FILTER STATE ---
const startDate = ref('')
const endDate = ref('')

// Load data when the page opens
onMounted(async () => {
  if (authStore.user?.role === 'Admin' || authStore.user?.role === 'Accounting') {
    try {
      await requestStore.fetchAllRequests()
    } catch (error) {
      console.error('Reports data load failed:', error)
    }
  }
})

// --- REPORT ANALYTICS LOGIC ---
// 1. Filter released requests by Date Range
const releasedRequestsInDateRange = computed(() => {
  let released = requestStore.requests.filter((req) => req.status === 'Released')

  if (startDate.value) {
    const start = new Date(startDate.value).setHours(0, 0, 0, 0)
    released = released.filter((req) => new Date(req.created_at).getTime() >= start)
  }
  if (endDate.value) {
    const end = new Date(endDate.value).setHours(23, 59, 59, 999)
    released = released.filter((req) => new Date(req.created_at).getTime() <= end)
  }

  return released
})

// 2. Calculate the specific total for that Date Range
const filteredTotalReleased = computed(() => {
  return releasedRequestsInDateRange.value.reduce(
    (acc, req) => acc + (Number(req.grand_total) || 0),
    0,
  )
})

// 3. Group the funds by Department
const departmentBreakdown = computed(() => {
  const breakdown = {
    CSIT: 0,
    CBEA: 0,
    CTHM: 0,
  }

  releasedRequestsInDateRange.value.forEach((req) => {
    const dept = req.department || 'Other'
    if (breakdown[dept] === undefined) breakdown[dept] = 0
    breakdown[dept] += Number(req.grand_total) || 0
  })

  // Convert object to array for easier rendering and sorting
  return Object.keys(breakdown)
    .map((key) => ({
      department: key,
      total: breakdown[key],
    }))
    .sort((a, b) => b.total - a.total) // Sorts from highest spending to lowest
})

const formatMoney = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0)

const clearDates = () => {
  startDate.value = ''
  endDate.value = ''
}
</script>

<template>
  <div class="page-content">
    <div class="header-flex"></div>

    <div class="card filter-card mb-4">
      <div class="filter-wrapper">
        <div class="filter-group">
          <label>Start Date</label>
          <input type="date" v-model="startDate" class="date-input" />
        </div>
        <div class="filter-separator">to</div>
        <div class="filter-group">
          <label>End Date</label>
          <input type="date" v-model="endDate" class="date-input" />
        </div>
        <div class="filter-actions">
          <button class="btn-clear" @click="clearDates">Clear Filters</button>
        </div>
      </div>
    </div>

    <div class="reports-grid">
      <div class="report-summary-box card">
        <label>TOTAL RELEASED (SELECTED PERIOD)</label>
        <h2 class="text-success">{{ formatMoney(filteredTotalReleased) }}</h2>
        <p class="small-text">Across {{ releasedRequestsInDateRange.length }} approved requests.</p>
      </div>

      <div class="department-breakdown card">
        <h3 class="section-title">Spending by Department</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Department</th>
              <th class="text-right">Total Released</th>
              <th class="text-right">% of Filtered Budget</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dept in departmentBreakdown" :key="dept.department">
              <td class="fw-bold">{{ dept.department }}</td>
              <td class="text-right text-success fw-bold">{{ formatMoney(dept.total) }}</td>
              <td class="text-right">
                <div class="progress-bar-container">
                  <div
                    class="progress-fill"
                    :style="{
                      width: filteredTotalReleased
                        ? (dept.total / filteredTotalReleased) * 100 + '%'
                        : '0%',
                    }"
                  ></div>
                </div>
                <span class="pct-text">
                  {{
                    filteredTotalReleased
                      ? Math.round((dept.total / filteredTotalReleased) * 100)
                      : 0
                  }}%
                </span>
              </td>
            </tr>
            <tr v-if="departmentBreakdown.every((d) => d.total === 0)">
              <td colspan="3" class="text-center empty-state-text">
                No budget released in this timeframe.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
