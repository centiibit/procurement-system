<script setup>
import { useAuthStore } from '../stores/auth'
const store = useAuthStore()
</script>

<template>
  <div class="page-content">
    <div class="card">
      <h2>System Status</h2>
      <p>
        Welcome back, <strong>{{ store.user?.firstname }} {{ store.user?.lastname }}</strong
        >.
      </p>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
</style>
