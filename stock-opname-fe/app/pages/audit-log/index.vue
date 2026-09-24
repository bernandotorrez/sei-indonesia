<script setup>
const api = useApi()
const selectedAction = ref('all')

const ACTIONS = [
  { label: 'All actions', value: 'all' },
  { label: 'Login success', value: 'AUTH_LOGIN_SUCCESS' },
  { label: 'Login failed', value: 'AUTH_LOGIN_FAILED' },
  { label: 'Login blocked (locked)', value: 'AUTH_LOGIN_BLOCKED' },
  { label: 'Account locked', value: 'AUTH_ACCOUNT_LOCKED' },
  { label: 'reCAPTCHA failed', value: 'AUTH_RECAPTCHA_FAILED' },
  { label: 'Product created', value: 'PRODUCT_CREATED' },
  { label: 'Product updated', value: 'PRODUCT_UPDATED' },
  { label: 'User created', value: 'USER_CREATED' },
  { label: 'User updated', value: 'USER_UPDATED' },
  { label: 'User unlocked', value: 'USER_UNLOCKED' },
  { label: 'Session initiated', value: 'AUDIT_SESSION_INITIATED' },
  { label: 'Counts submitted', value: 'AUDIT_SESSION_COUNTS_SUBMITTED' },
  { label: 'Approval requested', value: 'AUDIT_SESSION_APPROVAL_REQUESTED' },
  { label: 'Session approved', value: 'AUDIT_SESSION_APPROVED' },
  { label: 'Session rejected', value: 'AUDIT_SESSION_REJECTED' }
]

const { data: logs, pending, error } = await useAsyncData(
  'audit-logs',
  () => api.get('/audit-logs', selectedAction.value !== 'all' ? { query: { action: selectedAction.value } } : {}),
  { watch: [selectedAction] }
)

const ERROR_ACTIONS = new Set(['AUDIT_SESSION_REJECTED', 'AUTH_LOGIN_BLOCKED', 'AUTH_ACCOUNT_LOCKED'])
const SUCCESS_ACTIONS = new Set(['AUDIT_SESSION_APPROVED', 'AUTH_LOGIN_SUCCESS', 'USER_UNLOCKED'])

function actionColor(action) {
  if (action.includes('FAILED') || ERROR_ACTIONS.has(action)) return 'error'
  if (SUCCESS_ACTIONS.has(action)) return 'success'
  return 'neutral'
}

function actionLabel(action) {
  return ACTIONS.find(item => item.value === action)?.label || action
}

function formatTime(value) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">
        Audit Log
      </h1>
      <USelect
        v-model="selectedAction"
        :items="ACTIONS"
        class="w-56"
      />
    </div>

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
      v-else-if="!logs?.length"
      class="text-sm text-gray-500"
    >
      No activity recorded yet.
    </div>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800"
    >
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              When
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Actor
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Action
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Entity
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="log in logs"
            :key="log.id"
          >
            <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
              {{ formatTime(log.createdAt) }}
            </td>
            <td class="px-4 py-2">
              {{ log.actor?.name || log.actor_email || 'system' }}
            </td>
            <td class="px-4 py-2">
              <UBadge
                :color="actionColor(log.action)"
                variant="subtle"
              >
                {{ actionLabel(log.action) }}
              </UBadge>
            </td>
            <td class="px-4 py-2 text-xs text-gray-500">
              <span v-if="log.entity_type">{{ log.entity_type }} · {{ log.entity_id?.slice(0, 8) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
