import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useAuthStore } from '@/stores/auth'
import AccountsView from '@/views/AccountsView.vue'
import DashboardHome from '@/views/DashboardHome.vue'
import CreateRequestView from '@/views/CreateRequestView.vue'
import ApprovalsView from '@/views/ApprovalsView.vue'
import HistoryView from '@/views/HistoryView.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login', // Redirect root to login
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
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard-home',
          component: DashboardHome,
          meta: { title: 'Dashboard Overview' },
        },
        // This line makes AccountsView appear inside the Dashboard
        {
          path: 'users',
          name: 'users',
          component: AccountsView,
          meta: { title: 'User Management', requiresAdmin: true },
        },
        {
          path: 'request',
          name: 'request',
          component: CreateRequestView,
          meta: { title: ' ' },
        },
        {
          path: 'approval',
          name: 'approval',
          component: ApprovalsView,
          meta: { title: ' ' },
        },
        {
          path: 'history',
          name: 'history',
          component: HistoryView,
          meta: { title: 'Transaction History' },
        },
      ],
    },
  ],
})
// SECURITY GUARD
router.beforeEach((to, from, next) => {
  const store = useAuthStore()

  // 1. Check if page needs login
  if (to.meta.requiresAuth && !store.user) {
    return next('/login')
  }

  // 2. Check if page needs ADMIN permissions
  if (to.meta.requiresAdmin && store.user?.role !== 'Admin') {
    alert('Access Denied: You do not have permission to view this page.')
    return next('/dashboard') // Send them back to safety
  }

  // 3. Allow access
  next()
})
export default router
