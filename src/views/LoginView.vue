<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

// CSS FILE
import '@/assets/login.css'

const store = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const errorMessage = ref('')

const handleLogin = () => {
  const success = store.login(username.value, password.value)

  if (success) {
    router.push('/dashboard')
  } else {
    errorMessage.value = 'Invalid username or password'
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Welcome!</h1>
      <p class="subtitle">Please sign in to continue</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Username</label>
          <input type="text" v-model="username" placeholder="Enter username" required />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" v-model="password" placeholder="Enter password" required />
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button type="submit">Login</button>
      </form>
    </div>
  </div>
</template>
