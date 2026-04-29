<template>
  <div class="page-content">
    <div class="card">
      <h3>Items Ready for Release (Off-Chain)</h3>
      <table>
        <thead>
          <tr>
            <th>Ref No.</th>
            <th>Submitted By</th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in releaseQueue" :key="r.id">
            <td class="mono-text">{{ r.id }}</td>
            <td>
              <span class="fw-bold">{{ r.submitted_by_name }}</span
              ><br />
              <span class="small-text">{{ r.department }}</span>
            </td>
            <td class="fw-bold">
              ₱ {{ r.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 }) }}
            </td>
            <td>
              <button @click="handleRelease(r.id)" class="btn-release">Mark as Released</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="releaseQueue.length === 0" class="empty-state">
        <p>✅ No items waiting for release.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRequestStore } from '../stores/requests'
import '@/assets/dashboard.css' // Ensure consistency with your other views

const store = useRequestStore()

// Fetch all requests to ensure the Admin sees the full queue
onMounted(() => store.fetchAllRequests())

// Filter for the new status we created
const releaseQueue = computed(() => store.requests.filter((r) => r.status === 'Approved by Admin'))

const handleRelease = async (id) => {
  if (confirm('Confirm release of items? This will update the status to Released.')) {
    const success = await store.releaseRequest(id)
    if (success) {
      alert('Status updated to Released.')
    } else {
      alert('Failed to update status.')
    }
  }
}
</script>

<style scoped>
.mono-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  color: #555;
}

.small-text {
  font-size: 0.75rem;
  color: #666;
}

.btn-release {
  background-color: #f39c12; /* Orange for 'Release' action */
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.btn-release:hover {
  background-color: #e67e22;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}
</style>
