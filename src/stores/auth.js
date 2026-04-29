import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase' // Verified: Matches your file path!

export const useAuthStore = defineStore('auth', () => {
  // 1. STATE: Persistent session and user list
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const accounts = ref([])

  // 2. LOGIN (Security Update: Blocks disabled accounts)
  async function login(username, password) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('is_active', true) // Only allows active users to log in
        .single()

      if (error || !data) {
        throw new Error('Invalid credentials or account is disabled.')
      }

      user.value = data
      localStorage.setItem('user', JSON.stringify(data))
      return true
    } catch (e) {
      console.error('Login Error:', e.message)
      alert(e.message)
      return false
    }
  }

  // 3. LOGOUT
  function logout() {
    user.value = null
    localStorage.removeItem('user')
  }

  // 4. GET USERS (Loads the admin table)
  async function fetchAccounts() {
    try {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) throw error
      accounts.value = data
    } catch (e) {
      console.error('Error fetching users:', e.message)
    }
  }

  // 5. ADD USER
  async function addAccount(formData) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{ ...formData, is_active: true }]) // Default to active
        .select()

      if (error) throw error
      if (data) accounts.value.push(data[0])
      return true
    } catch (e) {
      console.error('Error adding user:', e.message)
      return false
    }
  }

  // 6. UPDATE USER (Fixed: Syncs session if you edit yourself)
  async function updateAccount(id, updatedData) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', id)
        .select()

      if (error) throw error

      // Update local accounts table
      const index = accounts.value.findIndex((u) => u.id === id)
      if (index !== -1 && data) {
        accounts.value[index] = data[0]
      }

      // Update current session if the edited user is the logged-in one
      if (user.value && user.value.id === id && data) {
        user.value = data[0]
        localStorage.setItem('user', JSON.stringify(data[0]))
      }
      return true
    } catch (e) {
      console.error('Error updating user:', e.message)
      return false
    }
  }

  // 7. TOGGLE STATUS (Replaces Delete for Data Integrity)
  async function toggleAccountStatus(id, currentStatus) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .select()

      if (error) throw error

      // Reflect change in UI
      const index = accounts.value.findIndex((u) => u.id === id)
      if (index !== -1 && data) {
        accounts.value[index] = data[0]
      }
      return true
    } catch (e) {
      console.error('Error toggling status:', e.message)
      return false
    }
  }

  return {
    user,
    accounts,
    login,
    logout,
    fetchAccounts,
    addAccount,
    updateAccount,
    toggleAccountStatus,
  }
})
