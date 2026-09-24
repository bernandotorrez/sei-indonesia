// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt'
  ],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // server-only: the Nuxt server routes are the only thing that talks to the Express API
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000/v1',
    authCookieName: 'stock_opname_token',
    public: {
      // Google reCAPTCHA v3 site key (public by design - the secret key stays backend-only).
      // Leave blank to disable the widget entirely for local dev.
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || ''
    }
  },

  compatibilityDate: '2025-01-01',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
