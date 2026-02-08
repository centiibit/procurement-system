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
      // PATCH: Capture the initial total into original_total field
      const finalPayload = {
        ...requestData,
        original_total: requestData.grand_total, // This locks the faculty's starting request amount
      }

      const { data, error: err } = await supabase.from('requests').insert([finalPayload]).select()

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

  // 2. FETCH PENDING APPROVALS
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
    if (!user || !user.role) {
      console.warn('fetchUserHistory: User data not ready yet.')
      return
    }

    loading.value = true
    const fullName = `${user.first_name} ${user.last_name}`

    try {
      let query = supabase.from('requests').select('*').order('created_at', { ascending: false })

      if (user.role === 'Faculty') {
        query = query.ilike('submitted_by_name', fullName)
      } else if (user.role === 'Dean') {
        query = query.eq('department', user.department)
      } else if (user.role === 'Accounting' || user.role === 'Admin' || user.role === 'admin') {
        console.log(`Admin/Accounting fetching the complete record history.`)
      }

      const { data, error: err } = await query
      if (err) throw err

      requests.value = data
    } catch (err) {
      console.error('Fetch History Error:', err.message)
    } finally {
      loading.value = false
    }
  }

  // 4. APPROVE REQUEST (Supports Budget Adjustments)
  const approveRequest = async (id, role, approverName, adjustments = null) => {
    try {
      const timestamp = new Date().toISOString()
      let updates = {}

      // If adjustments were made in the UI, update the working total and items
      if (adjustments) {
        updates.items = adjustments.items
        updates.grand_total = adjustments.grand_total
      }

      if (role === 'Dean') {
        updates.dean_approver = approverName
        updates.dean_approval_date = timestamp
        updates.status = 'Approved by Dean'
      } else if (role === 'Accounting') {
        updates.accounting_approver = approverName
        updates.accounting_approval_date = timestamp
        updates.status = 'Approved by Accounting'
      } else if (role === 'Admin' || role === 'admin') {
        updates.admin_approver = approverName
        updates.admin_approval_date = timestamp
        updates.status = 'Released'
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
