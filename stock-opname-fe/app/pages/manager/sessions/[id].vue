<script setup>
const route = useRoute()
const api = useApi()
const toast = useToast()

const { data: session, pending, error, refresh } = await useAsyncData(
  () => `manager-session-${route.params.id}`,
  () => api.get(`/audit-sessions/${route.params.id}`)
)

const approving = ref(false)
const rejecting = ref(false)
const rejectNote = ref('')
const showRejectForm = ref(false)
const actionError = ref('')

let pollTimer = null

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await refresh()
    if (session.value?.status !== 'APPROVING') stopPolling()
  }, 1500)
}

onUnmounted(stopPolling)

async function onApprove() {
  actionError.value = ''
  approving.value = true
  try {
    await api.post(`/audit-sessions/${route.params.id}/approve`)
    await refresh()
    toast.add({ title: 'Approval accepted, reconciling in the background…', color: 'info' })
    if (session.value?.status === 'APPROVING') startPolling()
  } catch (err) {
    actionError.value = err.message
  } finally {
    approving.value = false
  }
}

async function onReject() {
  actionError.value = ''
  if (!rejectNote.value.trim()) {
    actionError.value = 'A rejection note is required'
    return
  }
  rejecting.value = true
  try {
    await api.post(`/audit-sessions/${route.params.id}/reject`, { note: rejectNote.value })
    toast.add({ title: 'Session rejected', color: 'warning' })
    showRejectForm.value = false
    await refresh()
  } catch (err) {
    actionError.value = err.message
  } finally {
    rejecting.value = false
  }
}

const canReview = computed(() => session.value?.status === 'SUBMITTED')
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">
          {{ session?.code }}
        </h1>
        <p
          v-if="session"
          class="text-xs text-gray-500"
        >
          Assigned to {{ session.assignedStaff?.name }}
        </p>
      </div>
      <SessionStatusBadge
        v-if="session"
        :status="session.status"
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

    <template v-else-if="session">
      <UAlert
        v-if="session.status === 'OPEN'"
        color="neutral"
        variant="subtle"
        title="Waiting for staff to submit counts"
      />
      <UAlert
        v-else-if="session.status === 'APPROVING'"
        color="info"
        variant="subtle"
        title="Reconciling in the background…"
        description="Stock levels are being updated by the worker. This page refreshes automatically."
      />
      <UAlert
        v-else-if="session.status === 'APPROVED'"
        color="success"
        variant="subtle"
        title="Reconciled"
        description="Stock levels have been updated and logged."
      />
      <UAlert
        v-else-if="session.status === 'REJECTED'"
        color="error"
        variant="subtle"
        title="Rejected"
        :description="session.review_note || undefined"
      />

      <VarianceTable
        :items="session.items"
        :show-discrepancy="session.status !== 'OPEN'"
      />

      <UAlert
        v-if="actionError"
        color="error"
        variant="subtle"
        :title="actionError"
      />

      <div
        v-if="canReview"
        class="flex items-center gap-3"
      >
        <UButton
          :loading="approving"
          @click="onApprove"
        >
          Approve
        </UButton>
        <UButton
          color="error"
          variant="soft"
          @click="showRejectForm = !showRejectForm"
        >
          Reject
        </UButton>
      </div>

      <UCard v-if="showRejectForm">
        <UFormField label="Rejection note">
          <UTextarea
            v-model="rejectNote"
            class="w-full"
          />
        </UFormField>
        <UButton
          class="mt-3"
          color="error"
          :loading="rejecting"
          @click="onReject"
        >
          Confirm reject
        </UButton>
      </UCard>

      <UCard v-if="session.auditLogs?.length">
        <template #header>
          <h2 class="font-medium">
            Activity
          </h2>
        </template>
        <ActivityTimeline :logs="session.auditLogs" />
      </UCard>
    </template>
  </div>
</template>
