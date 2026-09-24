export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return apiFetch(event, '/users', { method: 'POST', body })
})
