<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRequestStore } from '../stores/requests'
import '@/assets/dashboard.css'

const authStore = useAuthStore()
const requestStore = useRequestStore()

// This runs as soon as the Admin lands on the Dashboard
onMounted(async () => {
  // If no user is logged in, don't fetch (prevents errors on logout)
  if (!authStore.user) return

  // Only Admin needs to load the global metrics
  if (isAdmin.value) {
    try {
      // Parallel fetch using the NEW function names in your store
      await Promise.all([
        authStore.fetchAccounts(),
        requestStore.fetchAllRequests(), // Fixed: Now matches the function name in requests.js
      ])
    } catch (error) {
      console.error('Dashboard data load failed:', error)
    }
  }
})

// Role check
const isAdmin = computed(() => {
  const role = authStore.user?.role?.toLowerCase()
  return role === 'admin'
})

// Report Calculations (Reactive to the store data)
// This ensures only finalized payments are counted in the total
const totalReleasedFunds = computed(() => {
  return requestStore.requests
    .filter((req) => req.status === 'Released')
    .reduce((acc, req) => acc + (Number(req.grand_total) || 0), 0)
})

const pendingCount = computed(() => {
  // Filters for requests that haven't been processed yet
  return requestStore.requests.filter((r) => r.status === 'Approved by Accounting').length
})

const activeUsersCount = computed(() => {
  return authStore.accounts.filter((u) => u.is_active).length
})

// --- NEW: LIQUIDATION METRIC ---
const pendingLiquidationsCount = computed(() => {
  return requestStore.requests.filter(
    (req) => req.status === 'Released' && req.liquidation_status !== 'Liquidated',
  ).length
})
</script>

<template>
  <div class="page-content">
    <div v-if="isAdmin" class="admin-dashboard">
      <h2 class="mb-4">Administrative Overview</h2>

      <div class="stats-grid">
        <div class="stat-card">
          <label>Total Budget Released</label>
          <h2 class="price-text">
            ₱ {{ totalReleasedFunds.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
          </h2>
        </div>

        <div class="stat-card border-warning">
          <label>Pending Approvals</label>
          <h2 class="warn-text">{{ pendingCount }}</h2>
        </div>

        <div class="stat-card border-info">
          <label>Pending Liquidations</label>
          <h2 class="info-text">{{ pendingLiquidationsCount }}</h2>
        </div>

        <div class="stat-card">
          <label>Active Employees</label>
          <h2>{{ activeUsersCount }}</h2>
        </div>
      </div>

      <div class="card mt-4">
        <h3>System Integrity</h3>
        <p>
          All data above is synced directly from the blockchain audit trail and database records.
        </p>
      </div>
    </div>

    <div v-else class="card">
      <h2>System Status</h2>
      <p>
        Welcome back,
        <strong class="user-name">
          {{ authStore.user?.first_name || 'User' }}
          {{ authStore.user?.last_name || '' }} </strong
        >.
      </p>
      <div class="user-actions mt-3">
        <p>
          Your Role: <span class="badge">{{ authStore.user?.role }}</span>
        </p>
        <p>Department: {{ authStore.user?.department || 'N/A' }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Grid layout for Admin cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(220px, 1fr)
  ); /* Adjusted slightly to fit 4 cards nicely */
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-top: 4px solid #42b883; /* Default Green */
}

/* Custom border colors for specific cards */
.stat-card.border-warning {
  border-top-color: #e67e22;
}

.stat-card.border-info {
  border-top-color: #3b82f6; /* Blue for Liquidation */
}

.price-text {
  color: #2c3e50;
  font-size: 1.8rem;
}

.warn-text {
  color: #e67e22;
}

.info-text {
  color: #3b82f6; /* Matching text color for Liquidation */
}

.card {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.user-name {
  color: #42b883;
}
.mt-3 {
  margin-top: 15px;
}
.mt-4 {
  margin-top: 20px;
}
.mb-4 {
  margin-bottom: 20px;
}

.badge {
  background: #eefdf6;
  color: #42b883;
  padding: 4px 10px;
  border-radius: 5px;
  font-weight: bold;
}
</style>
