<script setup>
defineProps({
  logs: { type: Array, default: () => [] }
})

const LABELS = {
  AUDIT_SESSION_INITIATED: 'Session initiated',
  AUDIT_SESSION_COUNTS_SUBMITTED: 'Counts submitted',
  AUDIT_SESSION_APPROVAL_REQUESTED: 'Approval requested',
  AUDIT_SESSION_APPROVED: 'Approved & reconciled',
  AUDIT_SESSION_REJECTED: 'Rejected'
}

function labelFor(action) {
  return LABELS[action] || action
}

function formatTime(value) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <ul class="space-y-3">
    <li
      v-for="log in logs"
      :key="log.id"
      class="flex items-start gap-3 text-sm"
    >
      <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
      <div>
        <p class="text-gray-900 dark:text-gray-100">
          {{ labelFor(log.action) }}
          <span
            v-if="log.actor"
            class="text-gray-500"
          >— {{ log.actor.name }}</span>
        </p>
        <p class="text-xs text-gray-500">
          {{ formatTime(log.createdAt) }}
        </p>
      </div>
    </li>
  </ul>
</template>
