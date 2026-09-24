import type { H3Event } from 'h3'

// Every server/api/* route funnels through here. It attaches the JWT (held only in an
// httpOnly cookie, never sent to client JS) as a Bearer header, and normalizes the Express
// API's { code, success, message, data } error envelope into a Nuxt H3 error the client's
// $fetch calls can read consistently.
export async function apiFetch<T = unknown>(event: H3Event, path: string, opts: Record<string, unknown> = {}): Promise<T> {
  const config = useRuntimeConfig(event)
  const token = getCookie(event, config.authCookieName as string)

  try {
    return await $fetch<T>(`${config.apiBaseUrl}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers as Record<string, string> | undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  } catch (error) {
    const fetchError = error as { response?: { status?: number }, statusCode?: number, data?: { message?: string, data?: unknown } }
    const status = fetchError?.response?.status || fetchError?.statusCode || 500
    const body = fetchError?.data || {}

    throw createError({
      statusCode: status,
      statusMessage: body.message || 'Request failed',
      message: body.message || 'Request failed',
      data: body.data
    })
  }
}
