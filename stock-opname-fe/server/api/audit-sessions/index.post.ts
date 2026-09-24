export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return apiFetch(event, '/audit-sessions', { method: 'POST', body })
})
