<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import { supabase } from '../supabase'
import { ethers } from 'ethers'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const store = useAuthStore()
const requestStore = useRequestStore()

// --- 1. BLOCKCHAIN CONFIGURATION ---
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const CONTRACT_ABI = [
  'function anchorByDean(string _id, bytes32 _hash, string _name) public',
  'function anchorByAccounting(string _id, bytes32 _hash, string _name) public',
  'function anchorByAdmin(string _id, bytes32 _hash, string _name) public',
]

// STATE VARIABLES
const activeTab = ref('budgets') // 'budgets' or 'liquidations'
const showModal = ref(false)
const selectedReq = ref(null)
const rejectionReason = ref('')
const isLoading = ref(false)

// LIQUIDATION STATE
const pendingLiquidations = ref([])
const showLiqModal = ref(false)
const selectedLiq = ref(null)

const isAccountingOrAdmin = computed(() => {
  return ['Accounting', 'accounting', 'Admin', 'admin'].includes(store.user?.role)
})

// --- 2. FOOLPROOF WALLET VALIDATION ---
const checkWalletConsistency = async () => {
  try {
    if (!window.ethereum) {
      alert('MetaMask not found! Please install it to continue.')
      return false
    }

    const profileWallet = store.user?.wallet_address?.toLowerCase()

    if (!profileWallet) {
      alert('Error: No authorized wallet address found in your profile.')
      return false
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const activeMetaMaskWallet = accounts[0].toLowerCase()

    if (profileWallet !== activeMetaMaskWallet) {
      alert(
        `Security Alert!\n\nYou are logged in as ${store.user.first_name},\nPlease switch to your authorized wallet.`,
      )
      return false
    }

    return true
  } catch (error) {
    console.error('Wallet Check Error:', error)
    return false
  }
}

// --- 3. BUDGET ADJUSTMENT LOGIC ---
const calculatedGrandTotal = computed(() => {
  if (!selectedReq.value || !selectedReq.value.items) return 0
  return selectedReq.value.items.reduce((sum, item) => {
    item.total = (item.quantity || 0) * (item.amount || 0)
    return sum + item.total
  }, 0)
})

const originalGrandTotal = computed(() => {
  const original = requestStore.requests.find((r) => r.id === selectedReq.value?.id)
  return original ? original.grand_total : 0
})

const budgetVariance = computed(() => calculatedGrandTotal.value - originalGrandTotal.value)

const getVarianceClass = (val) => {
  if (val < 0) return 'text-danger'
  if (val > 0) return 'text-warning'
  return 'text-gray'
}

// --- 4. DATA FETCHING ---
const loadLiquidations = async () => {
  if (!isAccountingOrAdmin.value) return
  try {
    let query = supabase
      .from('requests')
      .select('*')
      .eq('status', 'Released')
      .order('created_at', { ascending: true })

    // ROLE-BASED FILTERING FOR LIQUIDATIONS
    if (store.user?.role === 'Accounting' || store.user?.role === 'accounting') {
      query = query.eq('liquidation_status', 'Submitted')
    } else if (store.user?.role === 'Admin' || store.user?.role === 'admin') {
      query = query.eq('liquidation_status', 'Approved by Accounting')
    }

    const { data, error } = await query

    if (error) throw error
    pendingLiquidations.value = data
  } catch (err) {
    console.error('Error fetching liquidations:', err)
  }
}

const refreshData = () => {
  if (store.user?.role) {
    requestStore.fetchPendingApprovals(store.user.role, store.user.department)
    loadLiquidations()
  }
}

onMounted(() => {
  refreshData()
})

// --- 5. MODAL & HASHING ---
const openDetails = (req) => {
  selectedReq.value = JSON.parse(JSON.stringify(req))
  showModal.value = true
}

const closeDetails = () => {
  showModal.value = false
  selectedReq.value = null
  rejectionReason.value = ''
}

const generateAuditHash = async (id, original, final, name) => {
  // Strip decimals to prevent Supabase normalization errors
  const safeOriginal = Number(original).toString()
  const safeFinal = Number(final).toString()

  const dataString = `${id}-${safeOriginal}-${safeFinal}-${name}`
  const msgUint8 = new TextEncoder().encode(dataString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return '0x' + hashHex
}

// --- 6. AUTOMATED APPROVAL (BLOCKCHAIN + DATABASE) ---
const confirmApprove = async () => {
  if (!selectedReq.value) return

  isLoading.value = true
  try {
    const isWalletValid = await checkWalletConsistency()
    if (!isWalletValid) {
      isLoading.value = false
      return
    }

    const role = store.user.role
    const approverName = `${store.user.first_name} ${store.user.last_name}`
    const refId = selectedReq.value.id

    const finalHash = await generateAuditHash(
      refId,
      originalGrandTotal.value,
      calculatedGrandTotal.value,
      approverName,
    )

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

    alert(`Initiating Blockchain Transaction for ${refId}...`)

    let tx
    if (role === 'Dean') {
      tx = await contract.anchorByDean(refId, finalHash, approverName)
    } else if (role === 'Accounting' || role === 'accounting') {
      tx = await contract.anchorByAccounting(refId, finalHash, approverName)
    } else {
      tx = await contract.anchorByAdmin(refId, finalHash, approverName)
    }

    const txHash = tx.hash
    alert('Transaction sent! Waiting for confirmation on the network...')
    await tx.wait()

    const success = await requestStore.approveRequest(refId, role, approverName, {
      items: selectedReq.value.items,
      grand_total: calculatedGrandTotal.value,
      blockchain_tx_hash: txHash,
    })

    if (success) {
      alert(`✅ Approved!\nRef: ${refId}`)
      closeDetails()
      refreshData()
    }
  } catch (error) {
    console.error('Blockchain Error:', error)
    alert('Transaction failed. Check MetaMask and network status.')
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
      refreshData()
    }
  } catch (error) {
    console.error(error)
    alert('Failed to update database.')
  } finally {
    isLoading.value = false
  }
}

// --- 7. LIQUIDATION REVIEW LOGIC ---
const openLiquidationReview = (req) => {
  selectedLiq.value = req
  showLiqModal.value = true
}

const closeLiquidationReview = () => {
  showLiqModal.value = false
  selectedLiq.value = null
}

const confirmFinalizeLiquidation = async () => {
  isLoading.value = true
  try {
    // 1. Verify Wallet
    const isWalletValid = await checkWalletConsistency()
    if (!isWalletValid) {
      isLoading.value = false
      return
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const approverName = `${store.user?.first_name} ${store.user?.last_name}`
    const role = store.user?.role

    // 2. Hash the Verification Data
    const dataString = `VERIFIED-LIQ-${selectedLiq.value.id}-${approverName}`
    const msgUint8 = new TextEncoder().encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const liqHash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // 3. Request Signature via MetaMask
    alert(`Please sign to cryptographically confirm you have verified these receipts as ${role}.`)
    const signature = await signer.signMessage(liqHash)

    // 4. Save to Database (Passing role so store knows which column to update)
    const success = await requestStore.finalizeLiquidation(selectedLiq.value.id, signature, role)

    if (success) {
      alert(`✅ Liquidation for ${selectedLiq.value.id} has been signed and approved.`)
      closeLiquidationReview()
      refreshData()
    } else {
      alert('❌ Database Error: Supabase rejected the save. Make sure the signature columns exist.')
    }
  } catch (error) {
    console.error('Signature Error:', error)
    alert('Liquidation Cancelled: A digital signature is required to proceed.')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-content">
    <div
      class="header-row"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      "
    >
      <div class="nav-tabs" v-if="isAccountingOrAdmin">
        <button
          :class="['tab-btn', activeTab === 'budgets' ? 'active' : '']"
          @click="activeTab = 'budgets'"
        >
          Budget Approvals
        </button>
        <button
          :class="['tab-btn', activeTab === 'liquidations' ? 'active' : '']"
          @click="activeTab = 'liquidations'"
        >
          Liquidation Reviews
          <span v-if="pendingLiquidations.length" class="badge-count">{{
            pendingLiquidations.length
          }}</span>
        </button>
      </div>
      <h2 v-else>Pending Approvals</h2>

      <button @click="refreshData" class="btn-refresh">↻ Refresh Data</button>
    </div>

    <div v-show="activeTab === 'budgets'" class="card">
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
        <p>✅ No pending budget requests found.</p>
      </div>
    </div>

    <div v-show="activeTab === 'liquidations'" class="card">
      <table>
        <thead>
          <tr>
            <th>Ref No.</th>
            <th>Purpose</th>
            <th>Faculty Member</th>
            <th>Receipt Ref</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in pendingLiquidations" :key="req.id">
            <td class="mono-text">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td>
              <span class="fw-bold">{{ req.submitted_by_name }}</span
              ><br />
              <span class="small-text">{{ req.department }}</span>
            </td>
            <td>
              <span class="badge-receipt">{{ req.receipt_reference }}</span>
            </td>
            <td>
              <button
                @click="openLiquidationReview(req)"
                class="btn-view"
                style="background: #3b82f6"
              >
                🧾 Verify & Sign
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="pendingLiquidations.length === 0" class="empty-state">
        <p>✅ No pending liquidations.</p>
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
                <td><input type="number" v-model.number="item.amount" class="table-input" /></td>
                <td><input type="number" v-model.number="item.quantity" class="table-input" /></td>
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
            <p class="small-text text-blue">
              Authorized Wallet: <code>{{ store.user?.wallet_address }}</code>
            </p>
          </div>

          <div class="reject-section">
            <label>Rejection Remarks:</label>
            <textarea v-model="rejectionReason" class="reject-textarea"></textarea>
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

    <div v-if="showLiqModal" class="modal-overlay" @click.self="closeLiquidationReview">
      <div class="modal-content">
        <div class="modal-header" style="background: #334155; color: white">
          <h3>Liquidation Review: {{ selectedLiq?.id }}</h3>
        </div>

        <div class="modal-body">
          <div class="budget-comparison-bar" style="margin-bottom: 15px">
            <div class="summary-item">
              <label>Released Budget</label>
              <span
                >₱{{
                  Number(selectedLiq?.grand_total || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                }}</span
              >
            </div>
            <div class="summary-item">
              <label>Actual Spent</label>
              <span class="text-success"
                >₱{{
                  Number(selectedLiq?.actual_total || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })
                }}</span
              >
            </div>
            <div class="summary-item">
              <label>Variance (Change)</label>
              <span
                :class="
                  Number(selectedLiq?.actual_total) < Number(selectedLiq?.grand_total)
                    ? 'text-warning'
                    : 'text-gray'
                "
              >
                ₱{{
                  Math.abs(
                    Number(selectedLiq?.grand_total || 0) - Number(selectedLiq?.actual_total || 0),
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })
                }}
              </span>
            </div>
          </div>

          <div class="items-mini-card">
            <label class="section-label">LIST OF ITEMS</label>
            <table class="items-table-history">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th style="text-align: center">Qty</th>
                  <th class="text-right">Total Price</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in selectedLiq?.items" :key="i">
                  <td>{{ item.particulars }}</td>
                  <td style="text-align: center">{{ item.quantity }}</td>
                  <td class="text-right">
                    ₱{{
                      Number(item.amount * (item.quantity || 1)).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            class="approver-info"
            style="background: #f8fafc; border: 1px solid #e2e8f0; margin-top: 15px"
          >
            <label style="font-size: 0.7rem; font-weight: bold; color: #64748b"
              >RECEIPT / OR REFERENCE</label
            >
            <p style="font-size: 1.2rem; font-weight: bold; margin: 5px 0">
              {{ selectedLiq?.receipt_reference || 'N/A' }}
            </p>
          </div>

          <div
            class="signature-verification-card"
            style="
              margin-top: 20px;
              background: #f8fafc;
              border-left: 4px solid #10b981;
              padding: 15px;
            "
          >
            <span
              style="
                font-size: 0.65rem;
                font-weight: bold;
                color: #10b981;
                text-transform: uppercase;
              "
            >
              🧾 ON-CHAIN LIQUIDATION PROOF
            </span>

            <div v-if="selectedLiq?.liquidation_tx_hash" style="margin-top: 10px">
              <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 5px">
                Blockchain Tx Hash:
              </p>
              <code
                style="
                  display: block;
                  word-break: break-all;
                  color: #3b82f6;
                  font-size: 0.75rem;
                  background: #e0e7ff;
                  padding: 8px;
                  border-radius: 4px;
                "
              >
                {{ selectedLiq.liquidation_tx_hash }}
              </code>

              <a
                :href="'https://sepolia.etherscan.io/tx/' + selectedLiq.liquidation_tx_hash"
                target="_blank"
                style="
                  display: inline-block;
                  margin-top: 10px;
                  background: #10b981;
                  color: white;
                  padding: 8px 12px;
                  border-radius: 6px;
                  font-size: 0.75rem;
                  font-weight: bold;
                  text-decoration: none;
                "
              >
                Verify on Etherscan
              </a>
            </div>

            <div v-else>
              <p style="color: #ef4444; font-size: 0.8rem; font-weight: bold; margin-top: 10px">
                No blockchain anchor found. This liquidation is invalid.
              </p>
            </div>
          </div>

          <div
            class="approver-info"
            v-if="selectedLiq?.accounting_liq_signature"
            style="background: #f0fdf4; margin-top: 10px; border: 1px solid #bbf7d0"
          >
            <label style="font-size: 0.7rem; font-weight: bold; color: #16a34a"
              >ACCOUNTING VERIFICATION PROOF</label
            >
            <p
              class="small-text"
              style="word-break: break-all; margin: 5px 0; font-family: monospace; color: #166534"
            >
              {{ selectedLiq?.accounting_liq_signature }}
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeLiquidationReview" class="btn-cancel">Cancel</button>
          <button
            @click="confirmFinalizeLiquidation"
            class="btn-confirm"
            style="background: #10b981"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Processing...' : `Sign as ${store.user?.role}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* EXISTING STYLES */
.modal-large {
  max-width: 850px;
  width: 95%;
}
.budget-comparison-bar {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
}
.summary-item label {
  display: block;
  font-size: 0.7rem;
  color: #64748b;
}
.summary-item span {
  font-weight: 800;
  font-size: 1.1rem;
}
.table-input {
  width: 100%;
  text-align: right;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
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
}
.text-blue {
  color: #2563eb;
}
.small-text {
  font-size: 0.75rem;
}
.mt-2 {
  margin-top: 10px;
}

/* TABS STYLES */
.nav-tabs {
  display: flex;
  gap: 10px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 8px;
}
.tab-btn {
  background: transparent;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tab-btn:hover {
  background: #e2e8f0;
  color: #334155;
}
.tab-btn.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.badge-count {
  background: #ef4444;
  color: white;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 10px;
}
.badge-receipt {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: bold;
  color: #334155;
}

/* ITEMIZED LIST STYLES FOR LIQUIDATION MODAL */
.items-mini-card {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.section-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 800;
  color: #64748b;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.items-table-history {
  width: 100%;
  border-collapse: collapse;
}
.items-table-history th {
  font-size: 0.6rem;
  text-transform: uppercase;
  color: #94a3b8;
  text-align: left;
  padding-bottom: 6px;
  border-bottom: 2px solid #f1f5f9;
}
.items-table-history td {
  font-size: 0.8rem;
  padding: 6px 0;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}
.items-table-history tr:last-child td {
  border-bottom: none;
}
</style>
