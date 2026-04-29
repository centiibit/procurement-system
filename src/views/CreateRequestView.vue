<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { ethers } from 'ethers'
import '@/assets/dashboard.css'
import '@/assets/create-request.css'

const store = useAuthStore()
const requestStore = useRequestStore()
const router = useRouter()

// 1. FORM DATA
const form = ref({
  referenceNo: 'Generating...',
  purpose: '',
  venue: '',
  participants: '',
  dateRequested: new Date().toISOString().substr(0, 10),
  submittedBy: `${store.user?.first_name || ''} ${store.user?.last_name || ''}`,
  department: store.user?.department || '',
  items: [{ particulars: '', amount: 0, quantity: 1, total: 0 }],
})

// 2. GENERATE ID
onMounted(async () => {
  try {
    const currentYear = new Date().getFullYear().toString().slice(-2)
    const { data, error } = await supabase
      .from('requests')
      .select('id')
      .ilike('id', `${currentYear}-%`)
      .order('id', { ascending: false })
      .limit(1)

    if (error) throw error

    if (!data || data.length === 0) {
      form.value.referenceNo = `${currentYear}-00001`
    } else {
      const lastId = data[0].id
      const parts = lastId.split('-')
      if (parts.length === 2) {
        const nextNum = parseInt(parts[1]) + 1
        form.value.referenceNo = `${currentYear}-${String(nextNum).padStart(5, '0')}`
      } else {
        form.value.referenceNo = `${currentYear}-00001`
      }
    }
  } catch (error) {
    console.error('Error generating Ref No:', error)
    form.value.referenceNo = `ERR-${Date.now()}`
  }
})

// --- 3. FOOLPROOF WALLET CONSISTENCY CHECK ---
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
        `Security Alert!\n\nYou are logged in as ${store.user.first_name},\nPlease switch to your authorized wallet!`,
      )
      return false
    }
    return true
  } catch (error) {
    console.error('Wallet Check Error:', error)
    return false
  }
}

// 4. CALCULATIONS
const validateAmount = (event) => {
  const charCode = event.which ? event.which : event.keyCode
  if (charCode === 46) return true
  if (charCode < 48 || charCode > 57) event.preventDefault()
}

const validateQuantity = (event) => {
  const charCode = event.which ? event.which : event.keyCode
  if (charCode < 48 || charCode > 57) event.preventDefault()
}

const addItem = () => {
  form.value.items.push({ particulars: '', amount: 0, quantity: 1, total: 0 })
}

const removeItem = (index) => {
  if (form.value.items.length > 1) {
    form.value.items.splice(index, 1)
  }
}

const calculateRow = (item) => {
  item.total = (item.amount || 0) * (item.quantity || 0)
}

const grandTotal = computed(() => {
  return form.value.items.reduce((acc, item) => acc + item.total, 0)
})

const generateRequestHash = async (id, total, purpose, name) => {
  const dataString = `${id}-${total}-${purpose}-${name}`
  const msgUint8 = new TextEncoder().encode(dataString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 5. SUBMIT ACTION
const handleSubmit = async () => {
  if (!form.value.purpose) return alert('Please state the purpose.')
  if (grandTotal.value <= 0) return alert('Please add at least one valid item.')

  try {
    // A. PERFORM FOOLPROOF WALLET CHECK
    const isWalletValid = await checkWalletConsistency()
    if (!isWalletValid) return

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // B. GENERATE UNIQUE HASH
    const requestHash = await generateRequestHash(
      form.value.referenceNo,
      grandTotal.value,
      form.value.purpose,
      form.value.submittedBy,
    )

    // C. IDENTITY VERIFICATION SIGNATURE
    alert('Identity Verification Required: Please sign the request to prove this intent is yours.')
    const signature = await signer.signMessage(requestHash)

    // D. DYNAMIC ROLE LOGIC
    const userRole = store.user?.role?.toLowerCase()
    let initialStatus = 'Pending'
    let deanApprover = null
    let deanDate = null

    if (userRole === 'dean') {
      initialStatus = 'Approved by Dean'
      deanApprover = form.value.submittedBy
      deanDate = new Date().toISOString()
    }

    const payload = {
      id: form.value.referenceNo,
      submitted_by_name: form.value.submittedBy,
      purpose: form.value.purpose,
      venue: form.value.venue,
      participants: form.value.participants,
      department: form.value.department,
      items: form.value.items,
      grand_total: grandTotal.value,
      status: initialStatus,
      dean_approver: deanApprover,
      dean_approval_date: deanDate,
      requester_signature: signature,
    }

    const success = await requestStore.createRequest(payload)

    if (success) {
      alert(`✅ Request ${form.value.referenceNo} Digitally Signed & Submitted!`)
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('Submission Error:', error)
    alert('Submission Cancelled: A digital signature is required for verification.')
  }
}
</script>

<template>
  <div class="page-content">
    <div class="form-paper">
      <div class="form-header">
        <h2>REQUEST FOR FUNDS</h2>
        <div class="ref-box">
          <label>REF NO:</label>
          <span class="ref-num">{{ form.referenceNo }}</span>
        </div>
      </div>

      <div class="form-grid">
        <div class="input-group span-2">
          <label>Purpose / Activity Name</label>
          <input v-model="form.purpose" placeholder="e.g. IT Department Upgrade" />
        </div>
        <div class="input-group">
          <label>Date Requested</label>
          <input v-model="form.dateRequested" type="date" disabled />
        </div>
        <div class="input-group">
          <label>Venue</label>
          <input v-model="form.venue" placeholder="e.g. Computer Lab 1" />
        </div>
        <div class="input-group span-2">
          <label>Participants</label>
          <input v-model="form.participants" placeholder="e.g. Students and Faculty" />
        </div>
      </div>

      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%">Particulars / Item Description</th>
              <th style="width: 15%">Amount</th>
              <th style="width: 10%">Qty</th>
              <th style="width: 20%; text-align: right">Total</th>
              <th style="width: 10%; text-align: center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in form.items" :key="index">
              <td><input v-model="item.particulars" placeholder="Item Name" /></td>
              <td>
                <input
                  type="number"
                  v-model="item.amount"
                  @input="calculateRow(item)"
                  @keypress="validateAmount($event)"
                  placeholder="0.00"
                />
              </td>
              <td>
                <input
                  type="number"
                  v-model="item.quantity"
                  @input="calculateRow(item)"
                  @keypress="validateQuantity($event)"
                  placeholder="1"
                />
              </td>
              <td class="text-right">
                <input
                  :value="item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })"
                  readonly
                  class="readonly-input"
                />
              </td>
              <td style="text-align: center">
                <button @click="removeItem(index)" class="btn-remove">×</button>
              </td>
            </tr>

            <tr>
              <td colspan="5" style="padding: 0">
                <button type="button" @click="addItem" class="btn-add-row">
                  + Add Another Item
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
              <td class="grand-total">
                ₱ {{ grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="form-footer">
        <div class="footer-group">
          <label>Submitted By:</label>
          <input v-model="form.submittedBy" readonly />
        </div>
        <div class="footer-group">
          <label>Department:</label>
          <input v-model="form.department" readonly />
        </div>
      </div>

      <div class="action-area">
        <button @click="handleSubmit" class="btn-submit">Submit Request</button>
      </div>
    </div>
  </div>
</template>
