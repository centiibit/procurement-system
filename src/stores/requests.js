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
      const finalPayload = {
        ...requestData,
        original_total: requestData.grand_total, // Locks faculty's starting request amount
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

  // 3. FETCH HISTORY
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
      }
      // Admin/Accounting see complete record history

      const { data, error: err } = await query
      if (err) throw err

      requests.value = data
    } catch (err) {
      console.error('Fetch History Error:', err.message)
    } finally {
      loading.value = false
    }
  }

  // 4. FETCH ALL REQUESTS (Powers the Admin Reports)
  const fetchAllRequests = async () => {
    loading.value = true
    try {
      const { data, error: err } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      requests.value = data
    } catch (err) {
      console.error('Fetch All Requests Error:', err.message)
    } finally {
      loading.value = false
    }
  }

  // 5. APPROVE REQUEST (Updates status to Approved by Admin)
  const approveRequest = async (id, role, approverName, adjustments = null) => {
    try {
      const timestamp = new Date().toISOString()
      let updates = {}

      if (adjustments) {
        updates.items = adjustments.items
        updates.grand_total = adjustments.grand_total
        if (adjustments.blockchain_tx_hash) {
          updates.blockchain_tx_hash = adjustments.blockchain_tx_hash
        }
      }

      if (role === 'Dean') {
        updates.status = 'Approved by Dean'
        updates.dean_approver = approverName
        updates.dean_approval_date = timestamp
      } else if (role === 'Accounting') {
        updates.status = 'Approved by Accounting'
        updates.accounting_approver = approverName
        updates.accounting_approval_date = timestamp
      } else if (role === 'Admin' || role === 'admin') {
        updates.status = 'Approved by Admin'
        updates.admin_approver = approverName
        updates.admin_approval_date = timestamp
      }

      const { error: err } = await supabase.from('requests').update(updates).eq('id', id)
      if (err) throw err

      // Update local state by removing from the current view's list
      requests.value = requests.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      console.error('Approval Error:', err.message)
      return false
    }
  }

  // 6. RELEASE REQUEST (Off-chain manual step)
  const releaseRequest = async (id) => {
    try {
      const { error: err } = await supabase
        .from('requests')
        .update({ status: 'Released' })
        .eq('id', id)

      if (err) throw err

      // Update local state
      requests.value = requests.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      console.error('Release Error:', err.message)
      return false
    }
  }

  // 7. REJECT REQUEST
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

  // 8. SUBMIT LIQUIDATION (Updated for On-Chain Hash)
  const submitLiquidation = async (id, actualTotal, receiptRef, txHash) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          liquidation_status: 'Submitted',
          actual_total: actualTotal,
          receipt_reference: receiptRef,
          liquidation_tx_hash: txHash, // FIX: Separated into its own column
        })
        .eq('id', id)

      if (error) throw error

      // Update local state
      const index = requests.value.findIndex((r) => r.id === id)
      if (index !== -1) {
        requests.value[index].liquidation_status = 'Submitted'
        requests.value[index].actual_total = actualTotal
        requests.value[index].receipt_reference = receiptRef
        requests.value[index].liquidation_tx_hash = txHash
      }
      return true
    } catch (error) {
      console.error('Liquidation Error:', error)
      return false
    }
  }

  // 9. FINALIZE LIQUIDATION (Triple-Signature for Accounting & Admin)
  const finalizeLiquidation = async (id, signature, role) => {
    try {
      let updates = {}

      // Route based on role
      if (role === 'Accounting' || role === 'accounting') {
        updates.liquidation_status = 'Approved by Accounting'
        updates.accounting_liq_signature = signature
      } else if (role === 'Admin' || role === 'admin') {
        updates.liquidation_status = 'Liquidated'
        updates.admin_liq_signature = signature
      }

      const { error } = await supabase.from('requests').update(updates).eq('id', id)

      if (error) throw error

      // Update local state by removing it from the user's current pending list
      requests.value = requests.value.filter((r) => r.id !== id)
      return true
    } catch (error) {
      console.error('Finalize Liquidation Error:', error)
      return false
    }
  }

  // Make sure ALL state and functions are exported here
  return {
    requests,
    loading,
    error,
    createRequest,
    fetchPendingApprovals,
    fetchUserHistory,
    fetchAllRequests,
    approveRequest,
    releaseRequest,
    rejectRequest,
    submitLiquidation,
    finalizeLiquidation,
  }
})
