// Thin wrapper around Google reCAPTCHA v3. A no-op (returns null) whenever the site key isn't
// configured, so the login form works identically before the real key is dropped into .env -
// the backend's verifyRecaptcha() has the matching bypass on the secret-key side.
export function useRecaptcha() {
  const config = useRuntimeConfig()
  const siteKey = config.public.recaptchaSiteKey

  function loadScript() {
    return new Promise((resolve, reject) => {
      if (window.grecaptcha) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load reCAPTCHA'))
      document.head.appendChild(script)
    })
  }

  async function getToken(action = 'login') {
    if (!siteKey || typeof window === 'undefined') return null

    try {
      await loadScript()
      return await new Promise((resolve) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(siteKey, { action }).then(resolve)
        })
      })
    } catch {
      // Never let a reCAPTCHA loading hiccup block someone from attempting to log in - the
      // backend treats a missing token as "no score available" rather than an automatic failure
      // only when its own secret key is also unset; otherwise it will reject appropriately.
      return null
    }
  }

  return { getToken, enabled: !!siteKey }
}
