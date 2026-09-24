<script setup>
const api = useApi()
const { data: sessions, pending, error } = await useAsyncData('staff-sessions', () => api.get('/audit-sessions'))
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">
      My Audit Sessions
    </h1>

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
      v-else-if="!sessions?.length"
      class="text-sm text-gray-500"
    >
      No sessions assigned to you yet. Ask a manager to initiate one.
    </div>

    <UCard
      v-for="session in sessions"
      :key="session.id"
    >
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">
            {{ session.code }}
          </p>
          <p class="text-xs text-gray-500">
            {{ session.items.length }} item(s)
          </p>
        </div>
        <div class="flex items-center gap-3">
          <SessionStatusBadge :status="session.status" />
          <UButton
            size="xs"
            :to="`/staff/sessions/${session.id}`"
          >
            Open
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
