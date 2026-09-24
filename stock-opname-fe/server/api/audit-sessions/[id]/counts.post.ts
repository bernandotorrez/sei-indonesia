export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  return apiFetch(event, `/audit-sessions/${id}/counts`, { method: 'POST', body })
})
