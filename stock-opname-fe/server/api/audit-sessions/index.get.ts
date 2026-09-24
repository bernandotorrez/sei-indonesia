export default defineEventHandler((event) => {
  const query = getQuery(event)
  return apiFetch(event, '/audit-sessions', { query })
})
