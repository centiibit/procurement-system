<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const store = useAuthStore()
const requestStore = useRequestStore()

// STATE VARIABLES
const showModal = ref(false)
const selectedReq = ref(null)
const rejectionReason = ref('')
const isLoading = ref(false)

// --- 1. BUDGET ADJUSTMENT LOGIC ---

// Calculate the NEW Grand Total based on current input values
const calculatedGrandTotal = computed(() => {
  if (!selectedReq.value || !selectedReq.value.items) return 0
  return selectedReq.value.items.reduce((sum, item) => {
    // Update individual row total reactive to inputs
    item.total = (item.quantity || 0) * (item.amount || 0)
    return sum + item.total
  }, 0)
})

// Find the original amount from the store's list for comparison
const originalGrandTotal = computed(() => {
  const original = requestStore.requests.find((r) => r.id === selectedReq.value?.id)
  return original ? original.grand_total : 0
})

// Calculate the difference between Original and Adjusted
const budgetVariance = computed(() => {
  return calculatedGrandTotal.value - originalGrandTotal.value
})

// UI Helper for variance colors
const getVarianceClass = (val) => {
  if (val < 0) return 'text-danger' // Savings
  if (val > 0) return 'text-warning' // Increase
  return 'text-gray'
}

// --- 2. DATA FETCHING ---

onMounted(() => {
  if (store.user?.role) {
    requestStore.fetchPendingApprovals(store.user.role, store.user.department)
  }
})

// --- 3. MODAL CONTROLS ---

const openDetails = (req) => {
  // Deep clone to allow "what-if" adjustments without affecting the background list
  selectedReq.value = JSON.parse(JSON.stringify(req))
  showModal.value = true
}

const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
  rejectionReason.value = ''
}

// --- 4. APPROVE & REJECT LOGIC ---

const confirmApprove = async () => {
  if (!selectedReq.value) return

  isLoading.value = true
  try {
    const role = store.user.role
    const dept = store.user.department
    const approverName = `${store.user.first_name} ${store.user.last_name}`

    // Pass the adjusted items and the new total to the store
    const success = await requestStore.approveRequest(selectedReq.value.id, role, approverName, {
      items: selectedReq.value.items,
      grand_total: calculatedGrandTotal.value,
    })

    if (success) {
      alert('Request Approved with Adjustments!')
      closeDetails()
      requestStore.fetchPendingApprovals(role, dept)
    }
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}

const confirmReject = async () => {
  if (!selectedReq.value || !rejectionReason.value.trim()) {
    alert('Please provide a reason for rejection.')
    return
  }

  isLoading.value = true
  try {
    const success = await requestStore.rejectRequest(selectedReq.value.id, rejectionReason.value)
    if (success) {
      alert('Request Rejected.')
      closeDetails()
      requestStore.fetchPendingApprovals(store.user.role, store.user.department)
    }
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-content">
    <div class="header-row">
      <button
        @click="requestStore.fetchPendingApprovals(store.user?.role, store.user?.department)"
        class="btn-refresh"
      >
        ↻ Refresh List
      </button>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Ref No.</th>
            <th>Purpose</th>
            <th>Submitted By</th>
            <th>Original Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requestStore.requests" :key="req.id">
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>
              <span class="fw-bold">{{ req.submitted_by_name }}</span
              ><br />
              <span class="small-text">{{ req.department }}</span>
            </td>
            <td class="fw-bold">
              ₱{{ req.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
            </td>
            <td>
              <button @click="openDetails(req)" class="btn-view">👁 Review & Adjust</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="requestStore.requests.length === 0" class="empty-state">
        <p>✅ No pending requests found for {{ store.user?.department }}.</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeDetails">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>Budget Review: {{ selectedReq.id }}</h3>
        </div>

        <div class="modal-body">
          <div class="budget-comparison-bar">
            <div class="summary-item">
              <label>Original</label>
              <span
                >₱{{
                  originalGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })
                }}</span
              >
            </div>
            <div class="summary-item">
              <label>Adjusted</label>
              <span class="text-success"
                >₱{{
                  calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })
                }}</span
              >
            </div>
            <div class="summary-item">
              <label>Variance</label>
              <span :class="getVarianceClass(budgetVariance)">
                {{ budgetVariance > 0 ? '+' : '' }}₱{{
                  budgetVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })
                }}
              </span>
            </div>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <label>Purpose</label>
              <p>{{ selectedReq.purpose }}</p>
            </div>
            <div class="detail-item">
              <label>Requester</label>
              <p>{{ selectedReq.submitted_by_name }}</p>
            </div>
          </div>

          <h4 class="mt-4">Line Items Adjustment</h4>
          <table class="mini-table editable-table">
            <thead>
              <tr>
                <th>Particulars</th>
                <th width="120">Unit Price</th>
                <th width="100">Qty</th>
                <th width="120" class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in selectedReq.items" :key="i">
                <td>{{ item.particulars }}</td>
                <td>
                  <input type="number" v-model.number="item.amount" class="table-input" />
                </td>
                <td>
                  <input type="number" v-model.number="item.quantity" class="table-input" />
                </td>
                <td class="text-right fw-bold">₱{{ item.total?.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>

          <div class="approver-info">
            <p>
              Signing as:
              <strong>{{ store.user?.first_name }} {{ store.user?.last_name }}</strong> ({{
                store.user?.role
              }})
            </p>
          </div>

          <div class="reject-section">
            <label>Rejection Remarks (If applicable):</label>
            <textarea
              v-model="rejectionReason"
              class="reject-textarea"
              placeholder="State reason for rejection..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeDetails" class="btn-cancel">Cancel</button>
          <button @click="confirmReject" class="btn-reject" :disabled="isLoading">Reject</button>
          <button @click="confirmApprove" class="btn-confirm" :disabled="isLoading">
            Confirm & Approve
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-large {
  max-width: 850px;
  width: 95%;
}

/* Comparison Bar Styles */
.budget-comparison-bar {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
}
.summary-item {
  text-align: center;
}
.summary-item label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 4px;
}
.summary-item span {
  font-weight: 800;
  font-size: 1.1rem;
}

/* Table Input Styles */
.table-input {
  width: 100%;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  text-align: right;
  font-family: 'Courier New', Courier, monospace;
}
.table-input:focus {
  outline: 2px solid #3b82f6;
  border-color: transparent;
}

.text-success {
  color: #10b981;
}
.text-danger {
  color: #ef4444;
}
.text-warning {
  color: #f59e0b;
}
.text-gray {
  color: #64748b;
}
.text-right {
  text-align: right;
}

.approver-info {
  margin-top: 20px;
  padding: 10px;
  background: #eff6ff;
  border-radius: 4px;
  font-size: 0.9rem;
}
</style>
