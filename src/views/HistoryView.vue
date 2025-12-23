<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const authStore = useAuthStore()
const requestStore = useRequestStore()

const filterStatus = ref('All')

// --- MODAL STATE ---
const showModal = ref(false)
const selectedReq = ref(null)

// --- 1. FETCH DATA ---
const loadData = async () => {
  // Pass the entire user object so the store can filter by Role
  if (authStore.user?.role) {
    await requestStore.fetchUserHistory(authStore.user)
  }
}

// --- 2. TIMING WATCHER ---
// Ensures data loads as soon as the profile is retrieved from Supabase
watch(
  () => authStore.user,
  (newUser) => {
    if (newUser?.role) {
      loadData()
    }
  },
  { deep: true },
)

// --- 3. FILTER & SORT LOGIC ---
const filteredRequests = computed(() => {
  let data = [...requestStore.requests]

  if (filterStatus.value !== 'All') {
    if (filterStatus.value === 'Approved') {
      // Includes all successful approval steps and final release
      data = data.filter((req) => req.status.includes('Approved') || req.status === 'Released')
    } else {
      data = data.filter((req) => req.status === filterStatus.value)
    }
  }
  return data
})

// --- 4. MODAL LOGIC ---
const openDetails = (req) => {
  selectedReq.value = req
  showModal.value = true
}

const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
}

// --- 5. FORMATTERS ---
const getStatusClass = (status) => {
  if (status.includes('Approved') || status === 'Released') return 'badge-success'
  if (status === 'Rejected') return 'badge-danger'
  if (status === 'Pending') return 'badge-warning'
  return 'badge-secondary'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatMoney = (val) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(val || 0)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page-content">
    <div class="header-flex">
      <h1>Transaction History</h1>
    </div>

    <div class="filter-tabs">
      <button
        v-for="status in ['All', 'Pending', 'Approved', 'Rejected']"
        :key="status"
        @click="filterStatus = status"
        :class="['filter-btn', filterStatus === status ? 'active' : '']"
      >
        {{ status }}
      </button>
    </div>

    <div class="card">
      <div v-if="requestStore.loading" class="loading-state">Fetching history...</div>

      <table v-else>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref No.</th>
            <th>Purpose</th>
            <th>Department</th>
            <th>Total Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="req in filteredRequests"
            :key="req.id"
            @click="openDetails(req)"
            class="clickable-row"
          >
            <td class="text-gray">{{ formatDate(req.created_at) }}</td>
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>
              <span class="dept-tag">{{ req.department }}</span>
            </td>
            <td class="fw-bold">{{ formatMoney(req.grand_total) }}</td>
            <td>
              <span :class="['status-badge', getStatusClass(req.status)]">
                {{ req.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredRequests.length === 0 && !requestStore.loading" class="empty-state">
        <p>
          No records found for "<strong>{{ filterStatus }}</strong
          >".
        </p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeDetails">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Request Review: {{ selectedReq.id }}</h3>
        </div>

        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-item">
              <label>Current Status</label>
              <span :class="['status-badge', getStatusClass(selectedReq.status)]">
                {{ selectedReq.status }}
              </span>
            </div>
            <div class="detail-item">
              <label>Date Submitted</label>
              <p>{{ formatDate(selectedReq.created_at) }}</p>
            </div>
            <div class="detail-item">
              <label>Requester</label>
              <p>{{ selectedReq.submitted_by_name }}</p>
            </div>
            <div class="detail-item">
              <label>Department</label>
              <p>{{ selectedReq.department }}</p>
            </div>
          </div>

          <h4 class="mt-4 mb-2 font-bold">Items Breakdown</h4>
          <table class="mini-table">
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in selectedReq.items" :key="i">
                <td>{{ item.particulars }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ formatMoney(item.amount) }}</td>
                <td>{{ formatMoney(item.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-right font-bold">GRAND TOTAL:</td>
                <td class="font-bold text-green-600">{{ formatMoney(selectedReq.grand_total) }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="audit-section mt-6 p-4 bg-gray-50 border rounded-lg">
            <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Workflow Progress</h5>
            <div class="audit-trail-content">
              <div class="audit-row" :class="{ completed: selectedReq.dean_approver }">
                <p class="text-sm">
                  <span class="font-bold">1. Dean:</span>
                  {{ selectedReq.dean_approver ? '✓ Approved' : '○ Pending' }}
                </p>
              </div>

              <div class="audit-row mt-2" :class="{ completed: selectedReq.accounting_approver }">
                <p class="text-sm">
                  <span class="font-bold">2. Accounting:</span>
                  {{ selectedReq.accounting_approver ? '✓ Verified' : '○ Pending' }}
                </p>
              </div>

              <div class="audit-row mt-2" :class="{ completed: selectedReq.admin_approver }">
                <p class="text-sm">
                  <span class="font-bold">3. Admin:</span>
                  {{ selectedReq.admin_approver ? '✓ Released' : '○ Pending' }}
                </p>
              </div>

              <div v-if="selectedReq.status === 'Rejected'" class="reject-box mt-4">
                <p class="text-sm font-bold text-red-700">✕ REJECTED</p>
                <p class="text-sm italic">Reason: {{ selectedReq.rejection_reason }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeDetails" class="btn-cancel">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-trail-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.audit-row.completed p {
  color: #15803d;
}
.reject-box {
  background-color: #fef2f2;
  border-left: 4px solid #ef4444;
  padding: 10px;
}
</style>
