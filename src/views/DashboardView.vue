<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter, useRoute } from 'vue-router'
import '../assets/dashboard.css'

const store = useAuthStore()
const router = useRouter()
const route = useRoute()
const isSidebarOpen = ref(false)

const handleLogout = () => {
  store.logout()
  router.push('/login')
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Calculate the title based on the Router
const currentTitle = computed(() => {
  return route.meta.title || 'Dashboard Overview'
})
</script>

<template>
  <div class="dashboard-layout">
    <div class="sidebar-overlay" :class="{ active: isSidebarOpen }" @click="toggleSidebar"></div>

    <aside class="sidebar" :class="{ open: isSidebarOpen }">
      <div class="brand">
        <div class="header-row">
          <h2>Procurement System</h2>
          <button class="close-btn" @click="toggleSidebar">×</button>
        </div>
        <span class="badge">{{ store.user?.role || 'User' }}</span>
      </div>

      <nav class="menu">
        <p class="menu-label">MENU</p>

        <router-link to="/dashboard" class="nav-item" exact-active-class="active">
          <span>📊</span> Dashboard
        </router-link>

        <router-link to="/dashboard/request" class="nav-item" active-class="active">
          <span>📝</span> Request
        </router-link>

        <router-link
          v-if="
            ['Admin', 'admin', 'Dean', 'dean', 'Accounting', 'accounting'].includes(
              store.user?.role,
            )
          "
          to="/dashboard/approval"
          class="nav-item"
          active-class="active"
        >
          <span>✅</span> For Approval
        </router-link>

        <router-link
          v-if="['Admin', 'admin'].includes(store.user?.role)"
          to="/dashboard/release"
          class="nav-item"
          active-class="active"
        >
          <span>📦</span> For Release
        </router-link>

        <router-link to="/dashboard/history" class="nav-item" active-class="active">
          <span>🕒</span> History
        </router-link>

        <router-link to="/dashboard/liquidation" class="nav-item" active-class="active">
          <span>🧾</span> Liquidation
        </router-link>

        <router-link
          v-if="['Admin', 'admin', 'Accounting', 'accounting'].includes(store.user?.role)"
          to="/dashboard/reports"
          class="nav-item"
          active-class="active"
        >
          <span>📈</span> Reports
        </router-link>

        <router-link
          v-if="['Admin', 'admin'].includes(store.user?.role)"
          to="/dashboard/users"
          class="nav-item"
          active-class="active"
        >
          <span>👥</span> User Management
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button @click="handleLogout" class="logout-btn">Log Out</button>
      </div>
    </aside>

    <main class="main-content">
      <header>
        <div class="header-left">
          <button class="menu-btn" @click="toggleSidebar">☰</button>
          <h3>{{ currentTitle }}</h3>
        </div>

        <div class="user-info">
          <span>
            Welcome,
            <strong>{{ store.user?.first_name || 'User' }}</strong>
          </span>
        </div>
      </header>

      <div class="page-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>
