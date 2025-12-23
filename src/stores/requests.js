import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../supabase'

export const useRequestStore = defineStore('request', () => {
  const requests = ref([])
  const loading = ref(false)
  const error = ref(null)

  // 1. CREATE A NEW REQUEST
  const createRequest = async (requestData) => {
    loading.value = true
    try {
      const { data, error: err } = await supabase.from('requests').insert([requestData]).select()

      if (err) throw err

      if (data) {
        requests.value.unshift(data[0])
      }
      return true
    } catch (err) {
      console.error('Supabase Insert Error:', err.message)
      return false
    } finally {
      loading.value = false
    }
  }

  // 2. FETCH PENDING APPROVALS (Filter by Role & Dept)
  const fetchPendingApprovals = async (userRole, userDept) => {
    loading.value = true
    requests.value = []

    try {
      let query = supabase.from('requests').select('*').order('created_at', { ascending: true })

      if (userRole === 'Dean') {
        query = query.eq('status', 'Pending').eq('department', userDept)
      } else if (userRole === 'Accounting') {
        query = query.eq('status', 'Approved by Dean')
      } else if (userRole === 'Admin' || userRole === 'admin') {
        query = query.eq('status', 'Approved by Accounting')
      } else {
        return
      }

      const { data, error: err } = await query
      if (err) throw err
      requests.value = data
    } catch (err) {
      console.error('Fetch Approvals Error:', err.message)
    } finally {
      loading.value = false
    }
  }

  // 3. FETCH HISTORY (Universal for all roles)
  const fetchUserHistory = async (user) => {
    // Safety check: ensure user data is loaded
    if (!user || !user.role) {
      console.warn('fetchUserHistory: User data not ready yet.')
      return
    }

    loading.value = true
    const fullName = `${user.first_name} ${user.last_name}`

    try {
      // Base query: Get all requests, latest first
      let query = supabase.from('requests').select('*').order('created_at', { ascending: false })

      // ROLE-BASED LOGIC:
      // Faculty and Dean see their OWN requests.
      // Accounting and Admin see ALL requests (Full Transaction History).
      if (user.role === 'Faculty' || user.role === 'Dean') {
        console.log(`Fetching personal history for ${user.role}: ${fullName}`)
        query = query.ilike('submitted_by_name', fullName)
      } else {
        console.log(`Fetching full system history for ${user.role}`)
        // No filter added, retrieves everything for Accounting/Admin
      }

      const { data, error: err } = await query
      if (err) throw err

      console.log('Supabase History Results:', data)
      requests.value = data
    } catch (err) {
      console.error('Fetch History Error:', err.message)
    } finally {
      loading.value = false
    }
  }

  // 4. APPROVE REQUEST (Linear Chain)
  const approveRequest = async (id, role, approverName) => {
    try {
      const timestamp = new Date().toISOString()
      let updates = {}

      if (role === 'Dean') {
        updates = {
          dean_approver: approverName,
          dean_approval_date: timestamp,
          status: 'Approved by Dean',
        }
      } else if (role === 'Accounting') {
        updates = {
          accounting_approver: approverName,
          accounting_approval_date: timestamp,
          status: 'Approved by Accounting',
        }
      } else if (role === 'Admin' || role === 'admin') {
        updates = {
          admin_approver: approverName,
          admin_approval_date: timestamp,
          status: 'Released',
        }
      }

      const { error: err } = await supabase.from('requests').update(updates).eq('id', id)
      if (err) throw err

      requests.value = requests.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      console.error('Approval Error:', err.message)
      return false
    }
  }

  // 5. REJECT REQUEST
  const rejectRequest = async (id, reason) => {
    try {
      const { error: err } = await supabase
        .from('requests')
        .update({ status: 'Rejected', rejection_reason: reason })
        .eq('id', id)

      if (err) throw err
      requests.value = requests.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      console.error('Rejection Error:', err.message)
      return false
    }
  }

  return {
    requests,
    loading,
    error,
    createRequest,
    fetchPendingApprovals,
    fetchUserHistory,
    approveRequest,
    rejectRequest,
  }
})
