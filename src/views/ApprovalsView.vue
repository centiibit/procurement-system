<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const store = useAuthStore()
const requests = ref([])
const isLoading = ref(false)

// MODAL STATE
const showModal = ref(false)
const selectedReq = ref(null)
const rejectionReason = ref('')

// 1. FETCH DATA
const fetchRequests = async () => {
  try {
    const res = await axios.get('http://localhost:3000/requests')
    requests.value = res.data
  } catch (error) {
    console.error('Error fetching requests:', error)
  }
}

const pendingRequests = computed(() => {
  return requests.value.filter((req) => req.status === 'Pending')
})

// 2. OPEN MODAL
const openDetails = (req) => {
  selectedReq.value = req
  showModal.value = true
}

// 3. CLOSE MODAL
const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
  rejectionReason.value = ''
}

// 4. APPROVE ACTION
const confirmApprove = async () => {
  if (!selectedReq.value) return

  isLoading.value = true
  try {
    await axios.patch(`http://localhost:3000/requests/${selectedReq.value.id}`, {
      status: 'Approved',
      approver: `${store.user.firstname} ${store.user.lastname}`,
      approverID: store.user.id,
      approverDepartment: store.user.department,
      dateApproved: new Date().toISOString().split('T')[0],
    })

    alert('Request Approved Successfully!')
    closeDetails()
    fetchRequests()
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}

// 5. REJECT ACTION
const confirmReject = async () => {
  if (!selectedReq.value) return

  if (!rejectionReason.value.trim()) {
    alert('Please provide a reason for rejecting this request.')
    return
  }

  isLoading.value = true
  try {
    await axios.patch(`http://localhost:3000/requests/${selectedReq.value.id}`, {
      status: 'Rejected',
      approver: `${store.user.firstname} ${store.user.lastname}`,
      approverID: store.user.id,
      approverDepartment: store.user.department,
      dateApproved: new Date().toISOString().split('T')[0],
      remarks: rejectionReason.value,
    })

    alert('Request Rejected.')
    closeDetails()
    fetchRequests()
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchRequests()
})
</script>

<template>
  <div class="page-content">
    <h1>For Approval</h1>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Ref No.</th>
            <th>Purpose</th>
            <th>Submitted By</th>
            <th>Total</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in pendingRequests" :key="req.id">
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>{{ req.submittedBy }}</td>
            <td class="fw-bold">{{ req.grandTotal }}</td>
            <td>
              <button @click="openDetails(req)" class="btn-view">👁 View Details</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="pendingRequests.length === 0" class="empty-state">
        <p>✅ All caught up! No pending requests.</p>
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
              <p>{{ selectedReq.dateRequested }}</p>
            </div>
            <div class="detail-item">
              <label>Venue</label>
              <p>{{ selectedReq.venue }}</p>
            </div>
            <div class="detail-item">
              <label>Submitted By</label>
              <p>{{ selectedReq.submittedBy }}</p>
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
                <td>{{ item.total }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right; font-weight: bold">GRAND TOTAL:</td>
                <td style="font-weight: bold; color: green">{{ selectedReq.grandTotal }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="approver-section">
            <label>This request will be processed by:</label>
            <div class="approver-box">
              <span class="app-name">{{ store.user?.firstname }} {{ store.user?.lastname }}</span>
              <span class="app-dept">{{ store.user?.department }} ({{ store.user?.role }})</span>
            </div>
          </div>

          <div class="reject-input-section">
            <label class="reject-label">Rejection Remarks (Required if rejecting):</label>
            <textarea
              v-model="rejectionReason"
              class="reject-textarea"
              rows="2"
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
