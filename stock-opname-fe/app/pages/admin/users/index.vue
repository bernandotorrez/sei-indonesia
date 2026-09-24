<script setup>
const api = useApi()
const auth = useAuthStore()
const toast = useToast()

const { data: users, pending, error, refresh } = await useAsyncData('admin-users', () => api.get('/users'))

const ROLE_OPTIONS = [
  { label: 'Staff', value: 'staff' },
  { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' }
]

const form = reactive({ name: '', email: '', password: '', role: 'staff' })
const creating = ref(false)
const createError = ref('')

async function onCreate() {
  createError.value = ''
  creating.value = true
  try {
    await api.post('/users', { ...form })
    form.name = ''
    form.email = ''
    form.password = ''
    form.role = 'staff'
    toast.add({ title: 'User created', color: 'success' })
    await refresh()
  } catch (err) {
    createError.value = err.message
  } finally {
    creating.value = false
  }
}

async function onRoleChange(user, role) {
  try {
    await api.patch(`/users/${user.id}`, { role })
    toast.add({ title: `${user.name}'s role updated`, color: 'success' })
  } catch (err) {
    toast.add({ title: err.message, color: 'error' })
  } finally {
    await refresh()
  }
}

async function onToggleActive(user, isActive) {
  try {
    await api.patch(`/users/${user.id}`, { isActive })
    toast.add({ title: isActive ? `${user.name} activated` : `${user.name} deactivated`, color: 'success' })
  } catch (err) {
    toast.add({ title: err.message, color: 'error' })
  } finally {
    await refresh()
  }
}

async function onUnlock(user) {
  try {
    await api.post(`/users/${user.id}/unlock`)
    toast.add({ title: `${user.name}'s account unlocked`, color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: err.message, color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold">
      Users
    </h1>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Add user
        </h2>
      </template>

      <form
        class="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        @submit.prevent="onCreate"
      >
        <UFormField label="Name">
          <UInput
            v-model="form.name"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Email">
          <UInput
            v-model="form.email"
            type="email"
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
        <UFormField label="Role">
          <USelect
            v-model="form.role"
            :items="ROLE_OPTIONS"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="creating"
        >
          Add
        </UButton>
      </form>

      <UAlert
        v-if="createError"
        color="error"
        variant="subtle"
        :title="createError"
        class="mt-3"
      />
    </UCard>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error.message"
    />
    <div
      v-if="pending"
      class="text-sm text-gray-500"
    >
      Loading…
    </div>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800"
    >
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Name
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Email
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Role
            </th>
            <th class="px-4 py-2 text-center font-medium text-gray-500">
              Active
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="user in users"
            :key="user.id"
          >
            <td class="px-4 py-2">
              {{ user.name }}
              <UBadge
                v-if="user.id === auth.user.id"
                color="neutral"
                variant="subtle"
                size="xs"
                class="ml-1"
              >
                you
              </UBadge>
            </td>
            <td class="px-4 py-2 text-xs text-gray-500">
              {{ user.email }}
            </td>
            <td class="px-4 py-2">
              <USelect
                :model-value="user.role"
                :items="ROLE_OPTIONS"
                :disabled="user.id === auth.user.id"
                class="w-32"
                @update:model-value="(value) => onRoleChange(user, value)"
              />
            </td>
            <td class="px-4 py-2 text-center">
              <USwitch
                :model-value="user.isActive"
                :disabled="user.id === auth.user.id"
                @update:model-value="(value) => onToggleActive(user, value)"
              />
            </td>
            <td class="px-4 py-2">
              <template v-if="user.isLocked">
                <UBadge
                  color="error"
                  variant="subtle"
                >
                  Locked
                </UBadge>
                <UButton
                  size="xs"
                  variant="ghost"
                  class="ml-2"
                  @click="onUnlock(user)"
                >
                  Unlock
                </UButton>
              </template>
              <span
                v-else
                class="text-gray-500 text-xs"
              >OK</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
