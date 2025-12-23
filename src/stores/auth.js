import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase' // ⚠️ Make sure this matches your file path!

export const useAuthStore = defineStore('auth', () => {
  // 1. STATE: Load user from localStorage if available
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const accounts = ref([]) // Stores the list of users for Admin View

  // 2. LOGIN (Checks 'profiles' table)
  async function login(username, password) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single() // Expect exactly one match

      if (error || !data) throw error

      // Success: Update state and localStorage
      user.value = data
      localStorage.setItem('user', JSON.stringify(data))
      return true
    } catch (e) {
      console.error('Login Error:', e.message)
      return false
    }
  }

  // 3. LOGOUT
  function logout() {
    user.value = null
    localStorage.removeItem('user')
    // Optional: If using real Supabase Auth, you would add: await supabase.auth.signOut()
  }

  // 4. GET USERS (Loads the table for Admin)
  async function fetchAccounts() {
    try {
      const { data, error } = await supabase.from('profiles').select('*')

      if (error) throw error

      accounts.value = data
    } catch (e) {
      console.error('Error fetching users:', e.message)
    }
  }

  // 5. ADD USER (Saves to Supabase)
  async function addAccount(formData) {
    try {
      // NOTE: We do NOT generate an ID here anymore.
      // Supabase handles the UUID automatically.
      const { data, error } = await supabase
        .from('profiles')
        .insert([formData]) // Insert the object directly
        .select()

      if (error) throw error

      // Add the new user to our local list immediately
      if (data) {
        accounts.value.push(data[0])
      }
      return true
    } catch (e) {
      console.error('Error adding user:', e.message)
      return false
    }
  }

  // 6. DELETE USER
  async function deleteAccount(id) {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id)

      if (error) throw error

      // Remove from local list so the UI updates instantly
      accounts.value = accounts.value.filter((u) => u.id !== id)
    } catch (e) {
      console.error('Error deleting user:', e.message)
    }
  }

  return { user, accounts, login, logout, fetchAccounts, addAccount, deleteAccount }
})
