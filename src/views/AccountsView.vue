<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import '@/assets/dashboard.css' // Global Dashboard Styles
import '@/assets/user-management.css' // New Specific Page Styles

const store = useAuthStore()

const form = ref({
  firstname: '',
  lastname: '',
  department: '',
  role: 'Admin',
  walletAddress: '',
  username: '',
  password: '',
})

onMounted(() => {
  store.fetchAccounts()
})

const handleAdd = async () => {
  // 1. GLOBAL VALIDATION
  if (
    !form.value.firstname ||
    !form.value.lastname ||
    !form.value.username ||
    !form.value.password ||
    !form.value.department ||
    !form.value.walletAddress
  ) {
    return alert('All fields, including Wallet Address, are required.')
  }

  // 2. Submit to Store
  const success = await store.addAccount(form.value)

  if (success) {
    // 3. Reset Form
    form.value = {
      firstname: '',
      lastname: '',
      department: '',
      role: 'Admin',
      walletAddress: '',
      username: '',
      password: '',
    }
    alert('User Added Successfully!')
  } else {
    alert('Failed to add user.')
  }
}
</script>

<template>
  <div class="page-content">
    <div class="card form-card">
      <div class="card-header">
        <h3>Add New Employee</h3>
      </div>

      <div class="form-grid">
        <div class="input-group">
          <label>First Name</label>
          <input v-model="form.firstname" placeholder="e.g. Juan" />
        </div>
        <div class="input-group">
          <label>Last Name</label>
          <input v-model="form.lastname" placeholder="e.g. Dela Cruz" />
        </div>

        <div class="input-group">
          <label>Department</label>
          <input v-model="form.department" placeholder="e.g. CSIT" />
        </div>
        <div class="input-group">
          <label>Role</label>
          <select v-model="form.role">
            <option>Admin</option>
            <option>Staff</option>
            <option>Dean</option>
            <option>Faculty</option>
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
          <input v-model="form.walletAddress" placeholder="0x..." />
        </div>

        <div class="input-group full-width">
          <button @click="handleAdd" class="btn-add">+ Add User</button>
        </div>
      </div>
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
            <td class="fw-bold">{{ u.firstname }} {{ u.lastname }}</td>
            <td>{{ u.department }}</td>
            <td class="mono">{{ u.username }}</td>
            <td>
              <span :class="`badge ${u.role.toLowerCase()}`">{{ u.role }}</span>
            </td>
            <td class="mono small-text">
              {{
                u.walletAddress
                  ? u.walletAddress.substring(0, 6) + '...' + u.walletAddress.slice(-4)
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
    </div>
  </div>
</template>
