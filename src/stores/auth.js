import { ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

const API_URL = 'http://localhost:3000/users'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const accounts = ref([]) // Stores the list of users

  // 1. LOGIN (Checks Database)
  async function login(username, password) {
    try {
      const res = await axios.get(`${API_URL}?username=${username}&password=${password}`)
      if (res.data.length > 0) {
        user.value = res.data[0]
        localStorage.setItem('user', JSON.stringify(user.value))
        return true
      }
    } catch (e) {
      console.error(e)
    }
    return false
  }

  // 2. LOGOUT
  function logout() {
    user.value = null
    localStorage.removeItem('user')
  }

  // 3. GET USERS (Loads the table)
  async function fetchAccounts() {
    try {
      const res = await axios.get(API_URL)
      accounts.value = res.data
    } catch (e) {
      console.error(e)
    }
  }

  // 4. ADD USER (Saves to DB)
  async function addAccount(formData) {
    try {
      const newUser = {
        ...formData,
        id: Date.now().toString(), // Unique ID
      }

      const res = await axios.post(API_URL, newUser)
      accounts.value.push(res.data)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  // 5. DELETE USER
  async function deleteAccount(id) {
    try {
      await axios.delete(`${API_URL}/${id}`)
      accounts.value = accounts.value.filter((u) => u.id !== id)
    } catch (e) {
      console.error(e)
    }
  }

  return { user, accounts, login, logout, fetchAccounts, addAccount, deleteAccount }
})
