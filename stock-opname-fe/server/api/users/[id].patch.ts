export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  return apiFetch(event, `/users/${id}`, { method: 'PATCH', body })
})
