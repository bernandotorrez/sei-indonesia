<script setup>
definePageMeta({ layout: 'blank' })

const auth = useAuthStore()
const recaptcha = useRecaptcha()
const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

function homeFor() {
  if (auth.isAdmin) return '/admin/users'
  if (auth.isManager) return '/manager/sessions'
  return '/staff/sessions'
}

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    const recaptchaToken = await recaptcha.getToken('login')
    await auth.login({ ...form, recaptchaToken })
    await navigateTo(homeFor())
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          Stock Opname
        </h1>
        <p class="text-sm text-gray-500">
          Sign in to continue
        </p>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="onSubmit"
      >
        <UFormField label="Email">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="you@company.com"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Password">
          <UInput
            v-model="form.password"
            type="password"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Sign in
        </UButton>
      </form>

      <template #footer>
        <p class="text-xs text-gray-500">
          Demo: manager@stockopname.test / staff1@stockopname.test (password: password123)
        </p>
        <p
          v-if="recaptcha.enabled"
          class="text-xs text-gray-400 mt-2"
        >
          This site is protected by reCAPTCHA and the Google
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener"
            class="underline"
          >Privacy Policy</a>
          and
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener"
            class="underline"
          >Terms of Service</a>
          apply.
        </p>
      </template>
    </UCard>
  </div>
</template>
