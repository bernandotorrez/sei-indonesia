export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.ready) {
    await auth.fetchMe()
  }

  const isLoginPage = to.path === '/login'
  const homeFor = () => {
    if (auth.isAdmin) return '/admin/users'
    if (auth.isManager) return '/manager/sessions'
    return '/staff/sessions'
  }

  if (!auth.isAuthenticated) {
    if (!isLoginPage) return navigateTo('/login')
    return
  }

  if (isLoginPage || to.path === '/') {
    return navigateTo(homeFor())
  }

  if (to.path.startsWith('/admin') && !auth.isAdmin) {
    return navigateTo(homeFor())
  }

  if (to.path.startsWith('/manager') && !auth.isManager) {
    return navigateTo(homeFor())
  }

  if (to.path.startsWith('/staff') && !auth.isStaff) {
    return navigateTo(homeFor())
  }

  if (to.path === '/audit-log' && !(auth.isManager || auth.isAdmin)) {
    return navigateTo(homeFor())
  }
})
