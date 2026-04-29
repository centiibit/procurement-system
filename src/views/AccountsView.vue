<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import '@/assets/dashboard.css'
import '@/assets/user-management.css'

const store = useAuthStore()
const showModal = ref(false)
const isEditing = ref(false) // Track if we are editing
const editingId = ref(null) // Track the ID of the user being edited

// Form Data matches Supabase columns
const form = ref({
  first_name: '',
  last_name: '',
  department: '',
  role: 'Faculty',
  wallet_address: '',
  username: '',
  password: '',
})

onMounted(() => {
  store.fetchAccounts()
})

const openModal = () => {
  isEditing.value = false
  resetForm()
  showModal.value = true
}

const openEditModal = (u) => {
  isEditing.value = true
  editingId.value = u.id
  // Populate form with existing data
  form.value = {
    first_name: u.first_name,
    last_name: u.last_name,
    department: u.department,
    role: u.role,
    wallet_address: u.wallet_address,
    username: u.username,
    password: u.password,
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingId.value = null
  resetForm()
}

const handleSave = async () => {
  // 1. Validation
  if (
    !form.value.first_name ||
    !form.value.last_name ||
    !form.value.username ||
    !form.value.password ||
    !form.value.department ||
    !form.value.wallet_address
  ) {
    return alert('All fields are required.')
  }

  let success = false

  if (isEditing.value) {
    // 2a. Update logic
    success = await store.updateAccount(editingId.value, form.value)
  } else {
    // 2b. Add logic
    success = await store.addAccount(form.value)
  }

  if (success) {
    alert(isEditing.value ? 'User Updated Successfully!' : 'User Added Successfully!')
    closeModal()
  } else {
    alert('Operation failed.')
  }
}

const resetForm = () => {
  form.value = {
    first_name: '',
    last_name: '',
    department: '',
    role: 'Faculty',
    wallet_address: '',
    username: '',
    password: '',
  }
}
</script>

<template>
  <div class="page-content">
    <div class="table-header">
      <button @click="openModal" class="btn-primary">+ Add Employee</button>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Department</th>
            <th>Username</th>
            <th>Role</th>
            <th>Wallet</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in store.accounts" :key="u.id" :class="{ 'disabled-row': !u.is_active }">
            <td class="fw-bold">{{ u.first_name }} {{ u.last_name }}</td>
            <td>{{ u.department }}</td>
            <td class="mono">{{ u.username }}</td>
            <td>
              <span :class="`badge ${u.role ? u.role.toLowerCase() : 'user'}`">{{ u.role }}</span>
            </td>
            <td class="mono small-text">
              {{
                u.wallet_address
                  ? u.wallet_address.substring(0, 6) + '...' + u.wallet_address.slice(-4)
                  : 'Missing'
              }}
            </td>
            <td class="action-buttons">
              <button @click="openEditModal(u)" class="btn-edit">Edit</button>

              <button
                v-if="u.role !== 'Admin'"
                @click="store.toggleAccountStatus(u.id, u.is_active)"
                :class="u.is_active ? 'btn-disable' : 'btn-enable'"
              >
                {{ u.is_active ? 'Disable' : 'Enable' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.accounts.length === 0" class="empty-msg">No users found.</p>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Edit Employee' : 'Add New Employee' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="form-grid">
          <div class="input-group">
            <label>First Name</label>
            <input v-model="form.first_name" placeholder="e.g. Juan" />
          </div>
          <div class="input-group">
            <label>Last Name</label>
            <input v-model="form.last_name" placeholder="e.g. Dela Cruz" />
          </div>
          <div class="input-group">
            <label>Department</label>
            <input v-model="form.department" placeholder="e.g. CSIT" />
          </div>
          <div class="input-group">
            <label>Role</label>
            <select v-model="form.role">
              <option>Admin</option>
              <option>Dean</option>
              <option>Accounting</option>
              <option>Faculty</option>
              <option>Staff</option>
            </select>
          </div>
          <div class="input-group">
            <label>Username</label>
            <input v-model="form.username" placeholder="Login Username" />
          </div>
          <div class="input-group">
            <label>Password</label>
            <input v-model="form.password" type="text" placeholder="Login Password" />
          </div>
          <div class="input-group full-width">
            <label>MetaMask Wallet Address</label>
            <input v-model="form.wallet_address" placeholder="0x..." />
          </div>
          <div class="input-group full-width">
            <button @click="handleSave" class="btn-add">
              {{ isEditing ? 'Update User' : 'Save User' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
