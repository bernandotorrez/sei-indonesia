export default defineEventHandler((event) => {
  const query = getQuery(event)
  return apiFetch(event, '/products', { query })
})
