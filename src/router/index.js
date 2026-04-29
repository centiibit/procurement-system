import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import { useAuthStore } from '../stores/auth' // Import store to check roles
import AccountsView from '../views/AccountsView.vue'
import DashboardHome from '../views/DashboardHome.vue'
import CreateRequestView from '../views/CreateRequestView.vue'
import ApprovalsView from '../views/ApprovalsView.vue'
import HistoryView from '../views/HistoryView.vue'
import ReleaseView from '@/views/ReleaseView.vue'
import LiquidationView from '@/views/LiquidationView.vue'
import ReportsView from '@/views/ReportsView.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }, // Protect the whole dashboard
      children: [
        {
          path: '',
          name: 'dashboard-home',
          component: DashboardHome,
          meta: { title: 'Dashboard Overview' },
        },
        {
          path: 'users',
          name: 'users',
          component: AccountsView,
          // UPDATED: Only Admins can see this
          meta: {
            title: 'User Management',
            allowedRoles: ['Admin', 'admin'],
          },
        },
        {
          path: 'request',
          name: 'request',
          component: CreateRequestView,
          meta: { title: 'Create Request' },
        },
        {
          path: 'approval',
          name: 'approval',
          component: ApprovalsView,
          // UPDATED: Admin, Dean, and Accounting can see this
          meta: {
            title: 'Pending Approvals',
            allowedRoles: ['Admin', 'admin', 'Dean', 'dean', 'Accounting', 'accounting'],
          },
        },
        {
          path: 'history',
          name: 'history',
          component: HistoryView,
          meta: { title: 'Transaction History' },
        },
        {
          path: 'release',
          name: 'release',
          component: ReleaseView,
          meta: {
            title: 'For Release',
            allowedRole: ['Admin', 'admin'],
          },
        },
        {
          path: '/dashboard/liquidation',
          name: 'Liquidation',
          component: LiquidationView,
          meta: {
            title: 'Fund Liquidation',
          },
        },
        {
          path: '/dashboard/reports',
          name: 'Reports',
          component: ReportsView,
          meta: {
            title: 'Financial Reports',
            allowedRole: ['admin', 'Admin'],
          },
        },
      ],
    },
  ],
})

// --- SECURITY GUARD ---
router.beforeEach((to, from, next) => {
  const store = useAuthStore()

  // 1. Check if the User is Logged In
  // If the route requires auth and the user isn't logged in, kick them out.
  if (to.matched.some((record) => record.meta.requiresAuth) && !store.user) {
    return next('/login')
  }

  // 2. Check Role Permissions (New Flexible Logic)
  // If the route has an 'allowedRoles' list...
  if (to.meta.allowedRoles) {
    // Check if the user's role is in that list
    const userRole = store.user?.role

    if (!userRole || !to.meta.allowedRoles.includes(userRole)) {
      alert('Access Denied: You do not have permission to view this page.')
      return next('/dashboard') // Send them back to the main dashboard
    }
  }

  // 3. Allow Access
  next()
})

export default router
