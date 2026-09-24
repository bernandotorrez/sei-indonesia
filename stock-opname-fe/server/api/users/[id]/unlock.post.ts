export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return apiFetch(event, `/users/${id}/unlock`, { method: 'POST' })
})
