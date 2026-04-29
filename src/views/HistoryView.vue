<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import { ethers } from 'ethers'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'

const authStore = useAuthStore()
const requestStore = useRequestStore()

// --- 1. APPROVAL BLOCKCHAIN CONFIG ---
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const CONTRACT_ABI = [
  'function getAuditTrail(string _id) public view returns (tuple(string id, bytes32 dataHash, address deanApprover, string deanName, address acctApprover, string acctName, address adminApprover, string adminName, uint256 deanDate, uint256 acctDate, uint256 adminDate, string status))',
]

// --- 2. LIQUIDATION BLOCKCHAIN CONFIG (NEW) ---
const LIQ_CONTRACT_ADDRESS = import.meta.env.VITE_LIQUIDATION_CONTRACT_ADDRESS
const LIQ_CONTRACT_ABI = [
  'function getLiquidation(string _id) public view returns (tuple(string id, string items, string grandTotal, string actualTotal, string receiptRef, address liquidatorWallet, uint256 timestamp))',
]

// STATE VARIABLES
const filterStatus = ref('All')
const selectedDept = ref('All Departments')
const searchQuery = ref('')
const showModal = ref(false)
const selectedReq = ref(null)

// VERIFICATION & TRAIL STATE
const isVerifying = ref(false)
const verificationResult = ref(null)
const isFetchingTrail = ref(false)
const blockchainTrail = ref(null)
const isTrailExpanded = ref(false)
const isVerifyingSignature = ref(false)
const signatureStatus = ref(null)

// LIQUIDATION STATE (NEW)
const isFetchingLiq = ref(false)
const onchainLiquidationData = ref(null)

const departments = ['All Departments', 'CSIT', 'CBEA', 'CTHM']

const budgetVariance = computed(() => {
  if (!selectedReq.value) return 0
  return (selectedReq.value.grand_total || 0) - (selectedReq.value.original_total || 0)
})

const getVarianceClass = (val) => {
  if (val < 0) return 'text-danger'
  if (val > 0) return 'text-warning'
  return 'text-gray'
}

const loadData = async () => {
  if (authStore.user?.role) await requestStore.fetchUserHistory(authStore.user)
}

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser?.role) loadData()
  },
  { deep: true },
)

const filteredRequests = computed(() => {
  let data = [...requestStore.requests]
  if (filterStatus.value !== 'All') {
    if (filterStatus.value === 'Approved') {
      data = data.filter((req) => req.status.includes('Approved') || req.status === 'Released')
    } else {
      data = data.filter((req) => req.status === filterStatus.value)
    }
  }
  if (selectedDept.value !== 'All Departments')
    data = data.filter((req) => req.department === selectedDept.value)
  if (searchQuery.value.trim() !== '') {
    const query = searchQuery.value.toLowerCase()
    data = data.filter(
      (req) =>
        req.id.toLowerCase().includes(query) || req.submitted_by_name.toLowerCase().includes(query),
    )
  }
  return data
})

const generateVerificationHash = async (id, original, final, name) => {
  const dataString = `${id}-${original}-${final}-${name}`
  const msgUint8 = new TextEncoder().encode(dataString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const shortenAddress = (address) => {
  if (!address) return ''
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

const verifyRequesterSignature = async () => {
  if (!selectedReq.value?.requester_signature) return
  isVerifyingSignature.value = true
  try {
    const dataString = `${selectedReq.value.id}-${selectedReq.value.grand_total}-${selectedReq.value.purpose}-${selectedReq.value.submitted_by_name}`
    const msgUint8 = new TextEncoder().encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const currentHash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    const recoveredAddress = ethers.verifyMessage(
      currentHash,
      selectedReq.value.requester_signature,
    )
    signatureStatus.value = {
      status: 'success',
      message: `Verified: Digitally signed by ${selectedReq.value.submitted_by_name} (${shortenAddress(recoveredAddress)})`,
    }
  } catch (error) {
    signatureStatus.value = { status: 'danger', message: 'CRITICAL: Signature mismatch!' }
  } finally {
    isVerifyingSignature.value = false
  }
}

const verifyDatabaseIntegrity = async () => {
  if (!selectedReq.value) return
  isVerifying.value = true
  verificationResult.value = null
  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const currentLocalHash = await generateVerificationHash(
      selectedReq.value.id,
      selectedReq.value.original_total,
      selectedReq.value.grand_total,
      selectedReq.value.dean_approver || '',
    )
    const onChainData = await contract.getAuditTrail(selectedReq.value.id)
    const blockchainHash = onChainData.dataHash
    if (blockchainHash === '0x0000000000000000000000000000000000000000000000000000000000000000')
      verificationResult.value = { status: 'warning', message: 'No blockchain record found.' }
    else if (blockchainHash.toLowerCase() === currentLocalHash.toLowerCase())
      verificationResult.value = { status: 'success', message: 'INTEGRITY VERIFIED: Ledger Match.' }
    else verificationResult.value = { status: 'danger', message: 'DATA TAMPERING DETECTED!' }
  } catch (error) {
    verificationResult.value = { status: 'danger', message: 'Verification failed.' }
  } finally {
    isVerifying.value = false
  }
}

const fetchBlockchainTrail = async () => {
  if (!selectedReq.value) return
  isFetchingTrail.value = true
  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
    const result = await contract.getAuditTrail(selectedReq.value.id)
    blockchainTrail.value = {
      dean: { name: result.deanName, wallet: result.deanApprover },
      acct: { name: result.acctName, wallet: result.acctApprover },
      admin: { name: result.adminName, wallet: result.adminApprover },
    }
    isTrailExpanded.value = true
  } catch (error) {
    alert('Failed to fetch trail.')
  } finally {
    isFetchingTrail.value = false
  }
}

// --- NEW: FETCH ON-CHAIN LIQUIDATION ---
const fetchLiquidationOnChain = async () => {
  if (!selectedReq.value) return
  isFetchingLiq.value = true
  onchainLiquidationData.value = null

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const contract = new ethers.Contract(LIQ_CONTRACT_ADDRESS, LIQ_CONTRACT_ABI, provider)

    const result = await contract.getLiquidation(selectedReq.value.id)

    if (!result || !result.id || result.id === '') {
      alert('No on-chain liquidation record was found for this transaction.')
      return
    }

    onchainLiquidationData.value = {
      items: result.items,
      grandTotal: result.grandTotal,
      actualTotal: result.actualTotal,
      receiptRef: result.receiptRef,
      wallet: result.liquidatorWallet,
      timestamp: new Date(Number(result.timestamp) * 1000).toLocaleString('en-PH'),
    }
  } catch (error) {
    console.error(error)
    alert('Failed to retrieve Liquidation data from the Blockchain.')
  } finally {
    isFetchingLiq.value = false
  }
}

const openDetails = (req) => {
  selectedReq.value = req
  verificationResult.value = null
  signatureStatus.value = null
  blockchainTrail.value = null
  isTrailExpanded.value = false
  onchainLiquidationData.value = null // Reset Liquidation data
  showModal.value = true
}

const getSmartStatus = (req) => {
  if (req.status === 'Released' && req.liquidation_status) {
    if (req.liquidation_status === 'Submitted') return 'LIQ. SUBMITTED'
    if (req.liquidation_status === 'Approved by Accounting') return 'ACCT. VERIFIED'
    if (req.liquidation_status === 'Liquidated') return 'LIQUIDATED'
  }
  return req.status
}

const getStatusClass = (status) => {
  if (status === 'LIQUIDATED') return 'badge-success-dark'
  if (status === 'ACCT. VERIFIED') return 'badge-info'
  if (status === 'LIQ. SUBMITTED') return 'badge-blue'
  if (status.includes('Approved') || status === 'Released') return 'badge-success'
  if (status === 'Rejected') return 'badge-danger'
  return 'badge-warning'
}

const formatDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '-'
const formatMoney = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0)
const printVoucher = () => window.print()

onMounted(() => loadData())
</script>

<template>
  <div class="page-content">
    <div class="header-flex">
      <div
        v-if="authStore.user?.role === 'Accounting' || authStore.user?.role === 'Admin'"
        class="tools-container"
      >
        <input v-model="searchQuery" type="text" placeholder="Search..." class="search-input" />
        <select v-model="selectedDept" class="dept-dropdown">
          <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
        </select>
      </div>
    </div>

    <div class="filter-tabs">
      <button
        v-for="s in ['All', 'Pending', 'Approved', 'Rejected']"
        :key="s"
        @click="filterStatus = s"
        :class="['filter-btn', filterStatus === s ? 'active' : '']"
      >
        {{ s }}
      </button>
    </div>

    <div class="card">
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref No.</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Blockchain</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="req in filteredRequests"
            :key="req.id"
            @click="openDetails(req)"
            class="clickable-row"
          >
            <td>{{ formatDate(req.created_at) }}</td>
            <td class="mono-text">{{ req.id }}</td>
            <td class="fw-bold">{{ formatMoney(req.grand_total) }}</td>
            <td>
              <span :class="['status-badge', getStatusClass(getSmartStatus(req))]">{{
                getSmartStatus(req)
              }}</span>
            </td>
            <td>
              <span v-if="req.blockchain_tx_hash" class="verified-tag">🛡️ Anchored</span
              ><span v-else class="pending-tag">---</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-container">
        <div
          class="modal-header-dark no-print-header"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-right: 20px;
          "
        >
          <h2>Audit Summary: {{ selectedReq.id }}</h2>
          <button @click="printVoucher" class="btn-print-voucher">🖨️ Print Voucher</button>
        </div>

        <div class="modal-inner">
          <div class="print-only formal-header">
            <h2>IMMACULATE CONCEPTION I-COLLEGE OF ARTS AND TECHNOLOGY</h2>
            <div class="doc-line"></div>
            <p class="voucher-title">OFFICIAL PROCUREMENT STATEMENT</p>

            <div class="meta-row">
              <span><strong>REF NO:</strong> {{ selectedReq.id }}</span>
              <span
                ><strong>DATE GENERATED:</strong> {{ new Date().toLocaleDateString('en-PH') }}</span
              >
            </div>
          </div>

          <div class="audit-summary-section">
            <div class="summary-header-row">
              <div class="purpose-block">
                <label>PURPOSE</label>
                <p>{{ selectedReq.purpose }}</p>
              </div>
            </div>
            <div class="items-mini-card">
              <label class="section-label">ITEMIZED EXPENDITURE</label>
              <table class="items-table-history formal-table">
                <thead>
                  <tr>
                    <th>Particulars</th>
                    <th class="text-center">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, i) in selectedReq.items" :key="i">
                    <td>{{ item.particulars }}</td>
                    <td class="text-center">{{ item.quantity }}</td>
                    <td class="text-right">{{ formatMoney(item.amount) }}</td>
                    <td class="text-right fw-bold">
                      {{ formatMoney(item.amount * item.quantity) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" class="text-right fw-bold">TOTAL RELEASED:</td>
                    <td class="text-right fw-bold total-cell">
                      {{ formatMoney(selectedReq.grand_total) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="no-print">
            <div class="signature-verification-card">
              <div class="section-label">FACULTY IDENTITY PROOF</div>
              <div class="sig-action-row">
                <div class="sig-meta">
                  <span class="mono-label">Digital Signature Detected</span>
                  <p class="sig-preview">
                    {{
                      selectedReq.requester_signature
                        ? selectedReq.requester_signature.substring(0, 32) + '...'
                        : 'No Signature'
                    }}
                  </p>
                </div>
                <button
                  @click="verifyRequesterSignature"
                  class="btn-sig-verify"
                  :disabled="!selectedReq.requester_signature"
                >
                  Verify Faculty
                </button>
              </div>
              <div v-if="signatureStatus" :class="['sig-banner', signatureStatus.status]">
                {{ signatureStatus.message }}
              </div>
            </div>

            <div v-if="selectedReq.blockchain_tx_hash" class="blockchain-card-dark">
              <div class="engine-header">🛡️ Blockchain Verification Engine</div>
              <p
                style="
                  font-size: 0.65rem;
                  color: #94a3b8;
                  margin-bottom: 12px;
                  word-break: break-all;
                "
              >
                Tx Hash:
                <span style="color: #cbd5e1; font-family: monospace">{{
                  selectedReq.blockchain_tx_hash
                }}</span>
              </p>
              <div class="engine-actions-grid">
                <button
                  @click="verifyDatabaseIntegrity"
                  class="btn-engine scan"
                  :disabled="isVerifying"
                >
                  <span class="btn-label">{{ isVerifying ? 'Scanning...' : 'Scan' }}</span>
                </button>
                <button
                  @click="fetchBlockchainTrail"
                  class="btn-engine identity"
                  :disabled="isFetchingTrail"
                >
                  <span class="btn-label">{{ isFetchingTrail ? 'Fetching...' : 'Trail' }}</span>
                </button>
                <a
                  :href="'https://sepolia.etherscan.io/tx/' + selectedReq.blockchain_tx_hash"
                  target="_blank"
                  class="btn-engine explorer"
                >
                  <span class="btn-label">Explorer</span>
                </a>
              </div>

              <div
                v-if="blockchainTrail && isTrailExpanded"
                class="blockchain-collapsible-wrapper mt-3"
              >
                <h6
                  style="
                    color: #f8fafc;
                    font-size: 0.65rem;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                  "
                >
                  Immutable Blockchain Data
                </h6>
                <div
                  class="identity-item mb-1"
                  style="display: flex; justify-content: space-between; align-items: center"
                >
                  <span style="color: #cbd5e1; font-size: 0.75rem"
                    ><strong style="color: #94a3b8">Dean:</strong>
                    {{ blockchainTrail.dean.name }}</span
                  >
                  <code style="color: #60a5fa; font-size: 0.65rem">{{
                    shortenAddress(blockchainTrail.dean.wallet)
                  }}</code>
                </div>
                <div
                  class="identity-item mb-1"
                  v-if="blockchainTrail.acct.name"
                  style="display: flex; justify-content: space-between; align-items: center"
                >
                  <span style="color: #cbd5e1; font-size: 0.75rem"
                    ><strong style="color: #94a3b8">Acct:</strong>
                    {{ blockchainTrail.acct.name }}</span
                  >
                  <code style="color: #60a5fa; font-size: 0.65rem">{{
                    shortenAddress(blockchainTrail.acct.wallet)
                  }}</code>
                </div>
                <div
                  class="identity-item"
                  v-if="blockchainTrail.admin.name"
                  style="display: flex; justify-content: space-between; align-items: center"
                >
                  <span style="color: #cbd5e1; font-size: 0.75rem"
                    ><strong style="color: #94a3b8">Admin:</strong>
                    {{ blockchainTrail.admin.name }}</span
                  >
                  <code style="color: #60a5fa; font-size: 0.65rem">{{
                    shortenAddress(blockchainTrail.admin.wallet)
                  }}</code>
                </div>
              </div>

              <div
                v-if="verificationResult"
                :class="['result-banner', verificationResult.status]"
                style="margin-top: 10px"
              >
                {{ verificationResult.message }}
              </div>
            </div>

            <div
              v-if="selectedReq.liquidation_status"
              class="blockchain-card-dark"
              style="border-left: 4px solid #10b981; margin-top: 15px"
            >
              <div class="engine-header">🧾 Liquidation Smart Contract</div>
              <p style="font-size: 0.65rem; color: #94a3b8; margin-bottom: 12px">
                This expense report has been anchored to the blockchain.
              </p>

              <div class="engine-actions-grid" style="grid-template-columns: 1fr">
                <button
                  @click="fetchLiquidationOnChain"
                  class="btn-engine identity"
                  :disabled="isFetchingLiq"
                  style="background-color: #10b981"
                >
                  <span class="btn-label">{{
                    isFetchingLiq ? 'Querying Ledger...' : 'Retrieve On-Chain Liquidation Record'
                  }}</span>
                </button>
              </div>

              <div
                v-if="onchainLiquidationData"
                class="blockchain-collapsible-wrapper mt-3"
                style="border-color: #059669"
              >
                <h6
                  style="
                    color: #10b981;
                    font-size: 0.65rem;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                  "
                >
                  Immutable Expense Record
                </h6>

                <div class="identity-item mb-2">
                  <label style="color: #94a3b8; font-weight: bold; font-size: 0.7rem"
                    >Anchored Items:</label
                  >
                  <span style="color: #fff; font-size: 0.75rem; display: block; margin-top: 2px">{{
                    onchainLiquidationData.items
                  }}</span>
                </div>

                <div
                  class="identity-item mb-2"
                  style="display: flex; justify-content: space-between"
                >
                  <span style="color: #cbd5e1; font-size: 0.75rem"
                    ><strong style="color: #94a3b8">Receipt OR:</strong>
                    {{ onchainLiquidationData.receiptRef }}</span
                  >
                  <span style="color: #10b981; font-size: 0.75rem; font-weight: bold"
                    ><strong style="color: #94a3b8">Actual Spent:</strong> ₱{{
                      onchainLiquidationData.actualTotal
                    }}</span
                  >
                </div>

                <div
                  class="identity-item mb-2"
                  style="display: flex; justify-content: space-between; align-items: center"
                >
                  <span style="color: #cbd5e1; font-size: 0.75rem"
                    ><strong style="color: #94a3b8">Liquidator Wallet:</strong></span
                  >
                  <code
                    style="
                      color: #60a5fa;
                      font-size: 0.65rem;
                      background: #0f172a;
                      padding: 2px 4px;
                      border-radius: 4px;
                    "
                    >{{ shortenAddress(onchainLiquidationData.wallet) }}</code
                  >
                </div>

                <div
                  class="identity-item"
                  style="
                    font-size: 0.65rem;
                    color: #64748b;
                    text-align: right;
                    border-top: 1px dashed #334155;
                    padding-top: 8px;
                    margin-top: 8px;
                  "
                >
                  Anchored on: {{ onchainLiquidationData.timestamp }}
                </div>
              </div>
            </div>
          </div>

          <h3 class="trail-title no-print">Multi-Signature Workflow</h3>
          <div class="trail-container no-print">
            <div class="trail-item" :class="{ done: selectedReq.dean_approver }">
              <div class="trail-info">
                <label>DEAN</label>
                <p>{{ selectedReq.dean_approver || 'Pending' }}</p>
              </div>
            </div>
            <div class="trail-item" :class="{ done: selectedReq.accounting_approver }">
              <div class="trail-info">
                <label>ACCOUNTING</label>
                <p>{{ selectedReq.accounting_approver || 'Pending' }}</p>
              </div>
            </div>
            <div class="trail-item" :class="{ done: selectedReq.admin_approver }">
              <div class="trail-info">
                <label>ADMIN</label>
                <p>{{ selectedReq.admin_approver || 'Pending' }}</p>
              </div>
            </div>
          </div>

          <div class="print-only formal-signatures">
            <div class="sig-col">
              <p class="sig-cap">Requested By:</p>
              <div class="sig-space"></div>
              <p class="sig-name-val">{{ selectedReq.submitted_by_name }}</p>
            </div>
            <div class="sig-col">
              <p class="sig-cap">Noted By:</p>
              <div class="sig-space"></div>
              <p class="sig-name-val">
                {{ selectedReq.accounting_approver || '________________' }}
              </p>
            </div>
            <div class="sig-col">
              <p class="sig-cap">Final Approval:</p>
              <div class="sig-space"></div>
              <p class="sig-name-val">{{ selectedReq.admin_approver || '________________' }}</p>
            </div>
          </div>
        </div>
        <div class="modal-footer-light no-print">
          <button @click="showModal = false" class="btn-close-modal">Close Audit</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.badge-blue {
  background-color: #dbeafe;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}
.badge-info {
  background-color: #cffafe;
  color: #0e7490;
  border: 1px solid #a5f3fc;
}
.badge-success-dark {
  background-color: #064e3b;
  color: #34d399;
  border: 1px solid #059669;
}
.btn-print-voucher {
  background: #10b981;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}
.btn-print-voucher:hover {
  background: #059669;
}
.signature-verification-card {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #3b82f6;
  border-radius: 0 8px 8px 0;
  padding: 15px;
  margin-bottom: 20px;
}
.audit-summary-section {
  margin-bottom: 25px;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.items-mini-card {
  background: white;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  margin-bottom: 15px;
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
  padding-bottom: 5px;
}
.items-table-history td {
  font-size: 0.8rem;
  padding: 4px 0;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}
.blockchain-card-dark {
  background: #0f172a;
  border-radius: 10px;
  padding: 18px;
  color: white;
  margin-bottom: 25px;
}
.engine-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 12px;
}
.engine-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.btn-engine {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 45px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background-color: #3b82f6;
}
.btn-engine.scan {
  background-color: #10b981;
}
.btn-engine.identity {
  background-color: #6366f1;
}
.btn-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
}
.blockchain-collapsible-wrapper {
  background: #1e293b;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #334155;
}

/* PRINT FORMATTING */
.print-only {
  display: none;
}

@media print {
  header,
  .sidebar,
  .sidebar-overlay,
  .header-flex,
  .filter-tabs,
  .card,
  .no-print-header,
  .btn-close-modal,
  .no-print,
  .menu-btn,
  .user-info {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  .page-content {
    padding: 0 !important;
    margin: 0 !important;
  }
  .modal-overlay {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 100%;
    background: white !important;
  }
  .modal-container {
    width: 100% !important;
    border: none !important;
    box-shadow: none !important;
  }
  .modal-inner {
    padding: 0 !important;
  }

  .formal-header {
    text-align: center;
    margin-bottom: 30px;
  }
  .formal-header h2 {
    font-size: 16pt;
    margin: 0;
    font-weight: 800;
    color: #000;
  }
  .doc-line {
    border-bottom: 2px solid #000;
    margin: 10px 0;
  }
  .voucher-title {
    font-size: 14pt;
    font-weight: bold;
    text-decoration: underline;
    margin-top: 15px;
    text-align: center;
  }

  /* FIXED METADATA ALIGNMENT */
  .meta-row {
    display: flex !important;
    justify-content: space-between !important;
    width: 100%;
    font-size: 9pt;
    margin-top: 10px;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
  }

  .formal-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }
  .formal-table th,
  .formal-table td {
    border: 1px solid #000;
    padding: 8px !important;
    color: #000 !important;
  }
  .formal-signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 60px;
  }
  .sig-col {
    width: 30%;
    text-align: center;
  }
  .sig-cap {
    font-size: 9pt;
    text-align: left;
    font-weight: bold;
    margin-bottom: 30px;
  }
  .sig-space {
    border-bottom: 1px solid #000;
    margin-bottom: 5px;
  }
  .sig-name-val {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}

.trail-item {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
}
.btn-close-modal {
  width: 100%;
  background: #94a3b8;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}
.clickable-row {
  cursor: pointer;
}
.clickable-row:hover {
  background: #f1f5f9;
}
.verified-tag {
  color: #10b981;
  font-weight: bold;
  font-size: 0.8rem;
}
.header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}
</style>
