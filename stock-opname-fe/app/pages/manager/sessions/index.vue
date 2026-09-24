<script setup>
const api = useApi()
const { data: sessions, pending, error } = await useAsyncData('manager-sessions', () => api.get('/audit-sessions'))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        Audit Sessions
      </h1>
      <UButton
        to="/manager/sessions/new"
        icon="i-lucide-plus"
      >
        New session
      </UButton>
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
      v-else-if="!sessions?.length"
      class="text-sm text-gray-500"
    >
      No audit sessions yet.
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
            Assigned to {{ session.assignedStaff?.name }} · {{ session.items.length }} item(s)
          </p>
        </div>
        <div class="flex items-center gap-3">
          <SessionStatusBadge :status="session.status" />
          <UButton
            size="xs"
            :to="`/manager/sessions/${session.id}`"
          >
            Review
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
