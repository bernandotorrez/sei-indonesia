export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return apiFetch(event, '/products', { method: 'POST', body })
})
