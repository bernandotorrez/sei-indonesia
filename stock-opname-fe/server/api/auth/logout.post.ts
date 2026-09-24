export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  deleteCookie(event, config.authCookieName as string)
  return { code: 200, success: true, message: 'Logged out', data: null }
})
