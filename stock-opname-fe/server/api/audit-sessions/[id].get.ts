export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return apiFetch(event, `/audit-sessions/${id}`)
})
