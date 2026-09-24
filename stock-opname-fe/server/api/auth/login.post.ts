export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig(event)

  const result = await apiFetch<{ data: { token: string, user: unknown } }>(event, '/auth/login', { method: 'POST', body })

  setCookie(event, config.authCookieName as string, result.data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8
  })

  return { ...result, data: { user: result.data.user } }
})
