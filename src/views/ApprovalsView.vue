<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
// Importing your CSS files
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const store = useAuthStore()
const requestStore = useRequestStore()

// STATE VARIABLES
const showModal = ref(false)
const selectedReq = ref(null)
const rejectionReason = ref('')
const isLoading = ref(false)

// 1. FETCH DATA ON LOAD
onMounted(() => {
  if (store.user?.role) {
    // UPDATED: Now passing (Role, Department) so Deans only see their specific department
    requestStore.fetchPendingApprovals(store.user.role, store.user.department)
  }
})

// 2. MODAL CONTROLS
const openDetails = (req) => {
  selectedReq.value = req
  showModal.value = true
}

const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
  rejectionReason.value = ''
}

// 3. APPROVE LOGIC
const confirmApprove = async () => {
  if (!selectedReq.value) return

  isLoading.value = true
  try {
    const role = store.user.role
    const dept = store.user.department
    const approverName = `${store.user.first_name} ${store.user.last_name}`

    // Call the store function to update Supabase
    const success = await requestStore.approveRequest(selectedReq.value.id, role, approverName)

    if (success) {
      alert('Request Approved Successfully!')
      closeDetails()
      // Refresh list using the Department filter
      requestStore.fetchPendingApprovals(role, dept)
    }
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}

// 4. REJECT LOGIC
const confirmReject = async () => {
  if (!selectedReq.value) return

  if (!rejectionReason.value.trim()) {
    alert('Please provide a reason for rejection.')
    return
  }

  isLoading.value = true
  try {
    const success = await requestStore.rejectRequest(selectedReq.value.id, rejectionReason.value)

    if (success) {
      alert('Request Rejected.')
      closeDetails()
      // Refresh list using the Department filter
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
            <th>Total Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requestStore.requests" :key="req.id">
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>
              <span class="fw-bold">{{ req.submitted_by_name }}</span>
              <br />
              <span class="small-text">{{ req.department }}</span>
            </td>
            <td class="fw-bold">
              ₱{{ req.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
            </td>
            <td>
              <button @click="openDetails(req)" class="btn-view">👁 View Details</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="requestStore.requests.length === 0" class="empty-state">
        <p>✅ All caught up! No pending requests found for {{ store.user?.department }}.</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeDetails">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Review Request: {{ selectedReq.id }}</h3>
        </div>

        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-item">
              <label>Purpose</label>
              <p>{{ selectedReq.purpose }}</p>
            </div>
            <div class="detail-item">
              <label>Date Requested</label>
              <p>{{ new Date(selectedReq.created_at).toLocaleDateString() }}</p>
            </div>
            <div class="detail-item">
              <label>Venue</label>
              <p>{{ selectedReq.venue || 'N/A' }}</p>
            </div>
            <div class="detail-item">
              <label>Participants</label>
              <p>{{ selectedReq.participants || 'N/A' }}</p>
            </div>
            <div class="detail-item">
              <label>Submitted By</label>
              <p>{{ selectedReq.submitted_by_name }}</p>
            </div>
            <div class="detail-item">
              <label>Department</label>
              <p>{{ selectedReq.department }}</p>
            </div>
          </div>

          <h4>Items Breakdown</h4>
          <table class="mini-table">
            <thead>
              <tr>
                <th>Particulars</th>
                <th>Amount</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in selectedReq.items" :key="i">
                <td>{{ item.particulars }}</td>
                <td>{{ item.amount }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.total?.toLocaleString() }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right; font-weight: bold">GRAND TOTAL:</td>
                <td style="font-weight: bold; color: #27ae60">
                  ₱{{
                    selectedReq.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })
                  }}
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="approver-section">
            <label>You are approving as:</label>
            <div class="approver-box">
              <span class="app-name">{{ store.user?.first_name }} {{ store.user?.last_name }}</span>
              <span class="app-dept">{{ store.user?.department }} ({{ store.user?.role }})</span>
            </div>
          </div>

          <div class="reject-input-section">
            <label class="reject-label">Rejection Remarks (Required if rejecting):</label>
            <textarea
              v-model="rejectionReason"
              class="reject-textarea"
              placeholder="e.g. Budget exceeded, Duplicate request..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeDetails" class="btn-cancel">Cancel</button>

          <button @click="confirmReject" class="btn-reject" :disabled="isLoading">
            {{ isLoading ? 'Processing...' : 'Reject' }}
          </button>

          <button @click="confirmApprove" class="btn-confirm" :disabled="isLoading">
            {{ isLoading ? 'Processing...' : 'Approve Request' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Structural layout only - Design is in assets/approvals.css */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-refresh {
  background: white;
  border: 1px solid #ccc;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
  color: #555;
  font-weight: bold;
}
.btn-refresh:hover {
  background: #f1f1f1;
}

.small-text {
  font-size: 0.85rem;
  color: #666;
}
</style>
