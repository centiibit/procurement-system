<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import '@/assets/dashboard.css'
import '@/assets/create-request.css'

const store = useAuthStore()
const router = useRouter()

// 1. FORM DATA
const form = ref({
  referenceNo: 'Generating...',
  purpose: '',
  dateRequested: new Date().toISOString().substr(0, 10),
  venue: '',
  participants: '',
  submittedBy: `${store.user?.firstname} ${store.user?.lastname}`,
  department: store.user?.department,
  items: [{ particulars: '', amount: 0, quantity: 1, total: 0 }],
})

// --- SEQUENTIAL REFERENCE NO LOGIC ---
onMounted(async () => {
  try {
    const currentYear = new Date().getFullYear().toString().slice(-2)
    const response = await axios.get('http://localhost:3000/requests')
    const allRequests = response.data
    const thisYearRequests = allRequests.filter(
      (req) => req.id && req.id.startsWith(`${currentYear}-`),
    )

    if (thisYearRequests.length === 0) {
      form.value.referenceNo = `${currentYear}-00001`
    } else {
      const maxNum = thisYearRequests.reduce((max, req) => {
        const parts = req.id.split('-')
        if (parts.length === 2) {
          const numPart = parseInt(parts[1])
          return numPart > max ? numPart : max
        }
        return max
      }, 0)
      const nextNum = maxNum + 1
      form.value.referenceNo = `${currentYear}-${String(nextNum).padStart(5, '0')}`
    }
  } catch (error) {
    console.error('Error generating Ref No:', error)
    form.value.referenceNo = `${new Date().getFullYear().toString().slice(-2)}-ERROR`
  }
})

// 2. TABLE LOGIC

// --- NEW VALIDATION FUNCTIONS ---
// Use this for Amount (Allows numbers and one dot)
const validateAmount = (event) => {
  const charCode = event.which ? event.which : event.keyCode
  // Allow dot (46) but only if one doesn't exist yet (logic simplified for basic blocking)
  if (charCode === 46) return true
  // Block everything that isn't a number (0-9 are 48-57)
  if (charCode < 48 || charCode > 57) {
    event.preventDefault()
  }
}

// Use this for Quantity (Allows ONLY numbers, no dots)
const validateQuantity = (event) => {
  const charCode = event.which ? event.which : event.keyCode
  // Block everything that isn't a number
  if (charCode < 48 || charCode > 57) {
    event.preventDefault()
  }
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
  item.total = item.amount * item.quantity
}

const grandTotal = computed(() => {
  return form.value.items.reduce((acc, item) => acc + item.total, 0)
})

// 4. SUBMIT ACTION
const handleSubmit = async () => {
  if (!form.value.purpose) return alert('Please state the purpose.')

  const newRequest = {
    id: form.value.referenceNo,
    ...form.value,
    grandTotal: grandTotal.value,
    status: 'Pending',
    approver: null,
    walletAddress: store.user?.walletAddress || null,
  }

  try {
    await axios.post('http://localhost:3000/requests', newRequest)
    alert(`Request ${form.value.referenceNo} Submitted Successfully!`)
    window.location.reload()
  } catch (error) {
    console.error(error)
    alert('Error submitting request.')
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
          <input v-model="form.dateRequested" type="date" />
        </div>
        <div class="input-group">
          <label>Venue</label>
          <input v-model="form.venue" placeholder="e.g. Computer Lab 1" />
        </div>
        <div class="input-group span-2">
          <label>Participants</label>
          <input v-model="form.participants" placeholder="e.g. BSIT Students and Faculty" />
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
              <td>
                <input v-model="item.particulars" placeholder="Item Name" />
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  v-model="item.amount"
                  @input="calculateRow(item)"
                  @keypress="validateAmount($event)"
                  placeholder="0.00"
                />
              </td>

              <td>
                <input
                  type="number"
                  min="1"
                  v-model="item.quantity"
                  @input="calculateRow(item)"
                  @keypress="validateQuantity($event)"
                  placeholder="1"
                />
              </td>

              <td>
                <input :value="item.total" readonly tabindex="-1" class="readonly-input" />
              </td>

              <td style="text-align: center">
                <button @click="removeItem(index)" class="btn-remove" title="Remove Row">×</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
              <td class="grand-total">{{ grandTotal }}</td>
              <td style="padding: 0">
                <button @click="addItem" class="btn-add-row" title="Add Row">+</button>
              </td>
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
