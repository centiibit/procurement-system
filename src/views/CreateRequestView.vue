<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
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

// 2. GENERATE ID (Same as before)
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

// 3. CALCULATIONS (Same as before)
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
  item.total = item.amount * item.quantity
}

const grandTotal = computed(() => {
  return form.value.items.reduce((acc, item) => acc + item.total, 0)
})

// 4. SUBMIT ACTION (UPDATED LOGIC)
const handleSubmit = async () => {
  if (!form.value.purpose) return alert('Please state the purpose.')
  if (grandTotal.value <= 0) return alert('Please add at least one valid item.')

  // --- AUTO-APPROVAL LOGIC FOR DEAN ---
  const userRole = store.user?.role
  let initialStatus = 'Pending'
  let deanApprover = null
  let deanDate = null

  // If the requester IS the Dean, they auto-approve their step.
  if (userRole === 'Dean' || userRole === 'dean') {
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

    // Dynamic Fields based on Role
    status: initialStatus,
    dean_approver: deanApprover,
    dean_approval_date: deanDate,
  }

  console.log('Submitting Payload:', payload)

  const success = await requestStore.createRequest(payload)

  if (success) {
    alert(`Request ${form.value.referenceNo} Submitted Successfully!`)
    router.push('/dashboard')
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
                <input
                  :value="item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })"
                  readonly
                  tabindex="-1"
                  class="readonly-input"
                />
              </td>
              <td style="text-align: center">
                <button @click="removeItem(index)" class="btn-remove" title="Remove Row">×</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
              <td class="grand-total">
                {{ grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
              </td>
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
