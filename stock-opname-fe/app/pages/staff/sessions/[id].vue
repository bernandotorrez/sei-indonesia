<script setup>
const route = useRoute()
const api = useApi()
const toast = useToast()

const { data: session, pending, error, refresh } = await useAsyncData(
  () => `staff-session-${route.params.id}`,
  () => api.get(`/audit-sessions/${route.params.id}`)
)

const counts = reactive({})

watch(session, (value) => {
  if (!value) return
  for (const item of value.items) {
    if (!(item.product_id in counts)) {
      counts[item.product_id] = item.counted_qty ?? ''
    }
  }
}, { immediate: true })

const isEditable = computed(() => session.value?.status === 'OPEN')
const submitting = ref(false)
const submitError = ref('')

async function onSubmit() {
  submitError.value = ''

  const missing = session.value.items.filter(item => counts[item.product_id] === '' || counts[item.product_id] === null || counts[item.product_id] === undefined)
  if (missing.length > 0) {
    submitError.value = `Please enter a count for every item (missing: ${missing.map(item => item.product.sku).join(', ')})`
    return
  }

  submitting.value = true
  try {
    const items = session.value.items.map(item => ({
      productId: item.product_id,
      countedQty: Number(counts[item.product_id])
    }))
    await api.post(`/audit-sessions/${route.params.id}/counts`, { items })
    toast.add({ title: 'Counts submitted for review', color: 'success' })
    await refresh()
  } catch (err) {
    submitError.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">
          {{ session?.code }}
        </h1>
        <p class="text-xs text-gray-500">
          Assigned to you
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
        v-if="session.status === 'REJECTED'"
        color="error"
        variant="subtle"
        title="This session was rejected"
        :description="session.review_note || undefined"
      />
      <UAlert
        v-else-if="!isEditable"
        color="info"
        variant="subtle"
        :title="session.status === 'APPROVED' ? 'Reconciled' : 'Counts submitted'"
        description="Waiting for manager review."
      />

      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-500">
                SKU
              </th>
              <th class="px-4 py-2 text-left font-medium text-gray-500">
                Product
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-500">
                Expected
              </th>
              <th class="px-4 py-2 text-right font-medium text-gray-500">
                Your count
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr
              v-for="item in session.items"
              :key="item.id"
            >
              <td class="px-4 py-2 font-mono text-xs">
                {{ item.product.sku }}
              </td>
              <td class="px-4 py-2">
                {{ item.product.name }}
              </td>
              <td class="px-4 py-2 text-right">
                {{ item.expected_qty }}
              </td>
              <td class="px-4 py-2 text-right">
                <UInput
                  v-if="isEditable"
                  v-model="counts[item.product_id]"
                  type="number"
                  min="0"
                  class="w-28 ml-auto"
                />
                <span v-else>{{ item.counted_qty ?? '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <UAlert
        v-if="submitError"
        color="error"
        variant="subtle"
        :title="submitError"
      />

      <UButton
        v-if="isEditable"
        :loading="submitting"
        @click="onSubmit"
      >
        Submit Counts
      </UButton>

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
