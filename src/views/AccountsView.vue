<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import '@/assets/dashboard.css'
import '@/assets/user-management.css' // <--- Your separate CSS file

const store = useAuthStore()
const showModal = ref(false)

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
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleAdd = async () => {
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

  // 2. Submit
  const success = await store.addAccount(form.value)

  if (success) {
    alert('User Added Successfully!')
    resetForm()
    closeModal()
  } else {
    alert('Failed to add user.')
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
          <tr v-for="u in store.accounts" :key="u.id">
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
            <td>
              <button v-if="u.role !== 'Admin'" @click="store.deleteAccount(u.id)" class="btn-del">
                Delete
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
          <h3>Add New Employee</h3>
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
            <input v-model="form.password" type="password" placeholder="Login Password" />
          </div>

          <div class="input-group full-width">
            <label>MetaMask Wallet Address</label>
            <input v-model="form.wallet_address" placeholder="0x..." />
          </div>

          <div class="input-group full-width">
            <button @click="handleAdd" class="btn-add">Save User</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
