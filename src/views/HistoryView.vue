<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import '@/assets/dashboard.css'
import '@/assets/approvals.css' // Reusing modal and table styles

const requests = ref([])
const filterStatus = ref('All')
const isLoading = ref(false)

// --- MODAL STATE ---
const showModal = ref(false)
const selectedReq = ref(null)

// --- 1. FETCH DATA ---
const fetchHistory = async () => {
  isLoading.value = true
  try {
    const res = await axios.get('http://localhost:3000/requests')
    requests.value = res.data
  } catch (error) {
    console.error('Error loading history:', error)
  } finally {
    isLoading.value = false
  }
}

// --- 2. FILTER & SORT ---
const filteredRequests = computed(() => {
  const sorted = [...requests.value].sort((a, b) => {
    const dateA = new Date(a.dateRequested || 0)
    const dateB = new Date(b.dateRequested || 0)
    return dateB - dateA
  })

  if (filterStatus.value === 'All') return sorted
  return sorted.filter((req) => req.status === filterStatus.value)
})

// --- 3. MODAL LOGIC ---
const openDetails = (req) => {
  selectedReq.value = req
  showModal.value = true
}

const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
}

// --- 4. FORMATTERS ---
const getStatusClass = (status) => {
  switch (status) {
    case 'Approved':
      return 'badge-success'
    case 'Rejected':
      return 'badge-danger'
    case 'Pending':
      return 'badge-warning'
    default:
      return 'badge-secondary'
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatMoney = (val) => {
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val
  if (isNaN(num)) return val
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num)
}

onMounted(() => {
  fetchHistory()
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
      <div v-if="isLoading" class="loading-state">Loading records...</div>

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
            <td class="text-gray">{{ formatDate(req.dateRequested) }}</td>
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>
              <span class="dept-tag">{{ req.department || 'Gen' }}</span>
            </td>
            <td class="fw-bold">{{ formatMoney(req.grandTotal) }}</td>
            <td>
              <span :class="['status-badge', getStatusClass(req.status)]">
                {{ req.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredRequests.length === 0 && !isLoading" class="empty-state">
        <p>
          No records found for "<strong>{{ filterStatus }}</strong
          >".
        </p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeDetails">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Request Details: {{ selectedReq.id }}</h3>
        </div>

        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-item">
              <label>Status</label>
              <span :class="['status-badge', getStatusClass(selectedReq.status)]">
                {{ selectedReq.status }}
              </span>
            </div>
            <div class="detail-item">
              <label>Date Requested</label>
              <p>{{ formatDate(selectedReq.dateRequested) }}</p>
            </div>
            <div class="detail-item">
              <label>Purpose</label>
              <p>{{ selectedReq.purpose }}</p>
            </div>
            <div class="detail-item">
              <label>Department</label>
              <p>{{ selectedReq.department }} ({{ selectedReq.submittedBy }})</p>
            </div>
          </div>

          <h4 class="mt-4 mb-2 font-bold text-gray-700">Items Breakdown</h4>
          <table class="mini-table">
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in selectedReq.items" :key="i">
                <td>{{ item.particulars }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.amount }}</td>
                <td>{{ item.total }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-right font-bold">GRAND TOTAL:</td>
                <td class="font-bold text-green-600">{{ formatMoney(selectedReq.grandTotal) }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="audit-section mt-6 p-4 bg-gray-50 border rounded-lg">
            <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Audit Trail</h5>

            <div v-if="selectedReq.status === 'Approved'">
              <p class="text-sm">
                <span class="font-bold text-green-700">✓ Approved By:</span>
                {{ selectedReq.approver || 'System Admin' }}
              </p>
              <p class="text-xs text-gray-500">Date: {{ formatDate(selectedReq.dateApproved) }}</p>
            </div>

            <div v-else-if="selectedReq.status === 'Rejected'">
              <p class="text-sm">
                <span class="font-bold text-red-700">✕ Rejected By:</span>
                {{ selectedReq.approver || 'System Admin' }}
              </p>
              <p class="text-sm mt-1">
                <span class="font-bold text-gray-700">Reason:</span>
                <span class="italic text-red-600"
                  >"{{ selectedReq.remarks || 'No remarks provided.' }}"</span
                >
              </p>
            </div>

            <div v-else>
              <p class="text-sm text-yellow-700 italic">
                This request is currently pending approval.
              </p>
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
