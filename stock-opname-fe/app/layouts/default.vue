<script setup>
const auth = useAuthStore()
const route = useRoute()

const adminNav = [
  { label: 'Users', to: '/admin/users' },
  { label: 'Audit Log', to: '/audit-log' }
]
const managerNav = [
  { label: 'Sessions', to: '/manager/sessions' },
  { label: 'Products', to: '/manager/products' },
  { label: 'Audit Log', to: '/audit-log' }
]
const staffNav = [
  { label: 'My Sessions', to: '/staff/sessions' }
]

const navItems = computed(() => {
  if (auth.isAdmin) return adminNav
  if (auth.isManager) return managerNav
  return staffNav
})

const roleLabel = computed(() => {
  if (auth.isAdmin) return 'Admin'
  if (auth.isManager) return 'Manager'
  return 'Staff'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-gray-900 dark:text-white">Stock Opname</span>
          <UBadge
            v-if="auth.user"
            color="neutral"
            variant="subtle"
          >
            {{ roleLabel }}
          </UBadge>
        </div>

        <div
          v-if="auth.user"
          class="flex items-center gap-3"
        >
          <span class="text-sm text-gray-600 dark:text-gray-300">{{ auth.user.name }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-log-out"
            @click="auth.logout()"
          >
            Logout
          </UButton>
        </div>
      </div>

      <nav
        v-if="auth.user"
        class="mx-auto max-w-5xl px-4 flex items-center gap-1 -mb-px"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-3 py-2 text-sm border-b-2"
          :class="route.path.startsWith(item.to)
            ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-medium'
            : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
