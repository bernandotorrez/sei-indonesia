export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    ready: false
  }),

  getters: {
    isAuthenticated: state => !!state.user,
    isAdmin: state => state.user?.role === 'admin',
    isManager: state => state.user?.role === 'manager',
    isStaff: state => state.user?.role === 'staff'
  },

  actions: {
    async fetchMe() {
      const api = useApi()
      try {
        this.user = await api.get('/auth/me')
      } catch {
        this.user = null
      } finally {
        this.ready = true
      }
    },

    async login(credentials) {
      const api = useApi()
      const { user } = await api.post('/auth/login', credentials)
      this.user = user
      this.ready = true
      return user
    },

    async logout() {
      const api = useApi()
      await api.post('/auth/logout')
      this.user = null
      await navigateTo('/login')
    }
  }
})
