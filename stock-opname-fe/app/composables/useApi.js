// Thin wrapper around the Nuxt server BFF layer (server/api/**). Using useRequestFetch()
// instead of the global $fetch means cookies (the httpOnly auth token) are forwarded
// correctly both during SSR and on the client.
export function useApi() {
  const requestFetch = useRequestFetch()

  async function request(path, opts = {}) {
    try {
      const response = await requestFetch(`/api${path}`, opts)
      return response.data
    } catch (error) {
      const message = error?.data?.message || error?.statusMessage || 'Something went wrong'
      throw new Error(message, { cause: error })
    }
  }

  return {
    get: (path, opts = {}) => request(path, { method: 'GET', ...opts }),
    post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
    patch: (path, body, opts = {}) => request(path, { method: 'PATCH', body, ...opts })
  }
}
