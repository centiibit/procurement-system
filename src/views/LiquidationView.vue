<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import { ethers } from 'ethers'
import '@/assets/dashboard.css'
import '@/assets/approvals.css'
import '@/assets/liquidation.css'

const authStore = useAuthStore()
const requestStore = useRequestStore()

// --- NEW BLOCKCHAIN CONFIG (Points to the SECOND contract) ---
const LIQ_CONTRACT_ADDRESS = import.meta.env.VITE_LIQUIDATION_CONTRACT_ADDRESS
const LIQ_CONTRACT_ABI = [
  'function recordLiquidation(string _id, string _items, string _grandTotal, string _actualTotal, string _receiptRef) public',
]

// STATE
const showModal = ref(false)
const selectedReq = ref(null)
const actualTotal = ref(0)
const receiptRef = ref('')
const isSubmitting = ref(false)

// FETCH DATA
onMounted(async () => {
  if (authStore.user?.role) {
    await requestStore.fetchUserHistory(authStore.user)
  }
})

// FILTER
const liquidatableRequests = computed(() => {
  const userName = `${authStore.user?.first_name || ''} ${authStore.user?.last_name || ''}`
  let data = requestStore.requests.filter(
    (req) =>
      req.status === 'Released' &&
      (!req.liquidation_status || req.liquidation_status === 'Pending'),
  )
  if (authStore.user?.role !== 'Admin' && authStore.user?.role !== 'Accounting') {
    data = data.filter((req) => req.submitted_by_name === userName)
  }
  return data
})

// UI HELPERS
const formatMoney = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0)

const openLiquidation = (req) => {
  selectedReq.value = req
  actualTotal.value = req.grand_total
  receiptRef.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedReq.value = null
}

const checkWalletConsistency = async () => {
  try {
    if (!window.ethereum) {
      alert('MetaMask not found! Please install it to continue.')
      return false
    }
    const profileWallet = authStore.user?.wallet_address?.toLowerCase()
    if (!profileWallet) {
      alert('Error: No authorized wallet address found in your profile.')
      return false
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const activeMetaMaskWallet = accounts[0].toLowerCase()

    if (profileWallet !== activeMetaMaskWallet) {
      alert(`Security Alert!\n\nPlease switch to your authorized wallet!`)
      return false
    }
    return true
  } catch (error) {
    console.error('Wallet Check Error:', error)
    return false
  }
}

// --- ON-CHAIN LIQUIDATION LOGIC ---
const handleLiquidation = async () => {
  if (!receiptRef.value) return alert('Please enter a Receipt / OR Number.')
  if (actualTotal.value < 0) return alert('Actual amount cannot be negative.')

  isSubmitting.value = true
  try {
    const isWalletValid = await checkWalletConsistency()
    if (!isWalletValid) {
      isSubmitting.value = false
      return
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Connect to the NEW Liquidation Contract
    const contract = new ethers.Contract(LIQ_CONTRACT_ADDRESS, LIQ_CONTRACT_ABI, signer)

    // Format the items array into a clean string for the blockchain
    const itemsString = selectedReq.value.items
      .map((item) => `${item.particulars} (Qty: ${item.quantity})`)
      .join(', ')

    alert(
      'MetaMask will now open. Please confirm the transaction to anchor your liquidation to the blockchain.',
    )

    // Execute Smart Contract Function on the new contract
    const tx = await contract.recordLiquidation(
      String(selectedReq.value.id),
      itemsString,
      String(selectedReq.value.grand_total),
      String(actualTotal.value),
      String(receiptRef.value),
    )

    alert('Transaction sent! Waiting for blockchain confirmation... This may take a few seconds.')

    // Wait for the block to be mined
    const receipt = await tx.wait()

    // Save to Supabase (We store the Tx Hash instead of the signature)
    const success = await requestStore.submitLiquidation(
      selectedReq.value.id,
      actualTotal.value,
      receiptRef.value,
      receipt.hash,
    )

    if (success) {
      alert(`✅ Liquidation Anchored & Submitted!\nTx Hash: ${receipt.hash}`)
      closeModal()
      await requestStore.fetchUserHistory(authStore.user)
    } else {
      alert('❌ Database Error: Transaction succeeded on-chain, but Supabase rejected the save.')
    }
  } catch (error) {
    console.error('Liquidation Error:', error)
    alert('Liquidation Cancelled or Failed. Check console for details.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-content">
    <div class="header-flex">
      <p class="subtitle">Provide receipts and anchor actual expense totals to the blockchain.</p>
    </div>

    <div class="card">
      <table class="history-table">
        <thead>
          <tr>
            <th>Ref No.</th>
            <th>Purpose</th>
            <th>Released Budget</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="liquidatableRequests.length === 0">
            <td colspan="4" style="text-align: center; padding: 20px; color: #64748b">
              No pending liquidations found.
            </td>
          </tr>
          <tr v-for="req in liquidatableRequests" :key="req.id">
            <td class="mono-text fw-bold">{{ req.id }}</td>
            <td>{{ req.purpose }}</td>
            <td class="text-success fw-bold">{{ formatMoney(req.grand_total) }}</td>
            <td>
              <button @click="openLiquidation(req)" class="btn-action">Liquidate Funds</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header-dark">
          <h2>Liquidate: {{ selectedReq.id }}</h2>
        </div>

        <div class="modal-inner">
          <div class="info-box">
            <label>PURPOSE</label>
            <p>{{ selectedReq.purpose }}</p>

            <div class="items-mini-card mt-3">
              <label class="section-label">LIST OF ITEMS</label>
              <table class="items-table-history">
                <thead>
                  <tr>
                    <th>Particulars</th>
                    <th style="text-align: center">Qty</th>
                    <th class="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, i) in selectedReq.items" :key="i">
                    <td>{{ item.particulars }}</td>
                    <td style="text-align: center">{{ item.quantity }}</td>
                    <td class="text-right">
                      {{ formatMoney(item.amount * (item.quantity || 1)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="budget-split mt-3">
              <div>
                <label>RELEASED BUDGET</label>
                <h3 class="text-success">{{ formatMoney(selectedReq.grand_total) }}</h3>
              </div>
            </div>
          </div>

          <div class="form-section mt-4">
            <h4 class="section-title">Expense Report (On-Chain)</h4>

            <div class="input-group">
              <label>Official Receipt / Ref Number</label>
              <input
                v-model="receiptRef"
                type="text"
                placeholder="e.g., OR-102938"
                class="form-input"
              />
            </div>

            <div class="input-group mt-3">
              <label>Actual Amount Spent (₱)</label>
              <input v-model="actualTotal" type="number" min="0" step="0.01" class="form-input" />
            </div>

            <div class="variance-alert mt-3" v-if="actualTotal !== selectedReq.grand_total">
              <span v-if="actualTotal < selectedReq.grand_total">
                ⚠️ You must return
                <strong>{{ formatMoney(selectedReq.grand_total - actualTotal) }}</strong> to
                Accounting.
              </span>
              <span v-else-if="actualTotal > selectedReq.grand_total" class="text-danger">
                ⚠️ You exceeded the budget by
                <strong>{{ formatMoney(actualTotal - selectedReq.grand_total) }}</strong
                >. This requires special review.
              </span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">Cancel</button>
          <button @click="handleLiquidation" class="btn-submit-liq" :disabled="isSubmitting">
            {{ isSubmitting ? 'Anchoring to Blockchain...' : 'Anchor & Submit' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
