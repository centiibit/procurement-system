<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth' // Import the store
import '../assets/login.css'

const store = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  errorMessage.value = ''

  // Call the store action we just wrote
  const success = await store.login(username.value, password.value)

  if (success) {
    // Redirect based on the user role now stored in store.user
    if (store.user?.role === 'Admin') {
      router.push('/dashboard') // or wherever admins go
    } else {
      router.push('/dashboard')
    }
  } else {
    errorMessage.value = 'Invalid username or password'
  }

  loading.value = false
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Welcome Back!</h1>
      <p class="subtitle">Please sign in to continue</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Username</label>
          <input type="text" v-model="username" required placeholder="Enter username" />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" v-model="password" required placeholder="Enter password" />
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>
