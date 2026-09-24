<script setup>
const api = useApi()
const router = useRouter()

const { data: products } = await useAsyncData('new-session-products', () => api.get('/products'))
const { data: staffList } = await useAsyncData('new-session-staff', () => api.get('/users/staff'))

const selectedProductIds = ref([])
const assignedStaffId = ref(null)
const submitting = ref(false)
const submitError = ref('')

const staffOptions = computed(() => (staffList.value || []).map(person => ({ label: person.name, value: person.id })))
const productOptions = computed(() => (products.value || []).map(product => ({
  label: `${product.sku} — ${product.name} (on hand: ${product.on_hand_qty})`,
  value: product.id
})))

async function onSubmit() {
  submitError.value = ''

  if (selectedProductIds.value.length === 0) {
    submitError.value = 'Select at least one product to include in the snapshot'
    return
  }
  if (!assignedStaffId.value) {
    submitError.value = 'Choose a staff member to assign this session to'
    return
  }

  submitting.value = true
  try {
    const session = await api.post('/audit-sessions', {
      productIds: selectedProductIds.value,
      assignedStaffId: assignedStaffId.value
    })
    await router.push(`/manager/sessions/${session.id}`)
  } catch (err) {
    submitError.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-2xl">
    <h1 class="text-xl font-semibold">
      New Audit Session
    </h1>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          1. Assign staff
        </h2>
      </template>
      <USelect
        v-model="assignedStaffId"
        :items="staffOptions"
        placeholder="Choose staff"
        class="w-full"
      />
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          2. Pick products to snapshot
        </h2>
      </template>
      <UCheckboxGroup
        v-model="selectedProductIds"
        :items="productOptions"
        class="max-h-96 overflow-y-auto"
      />
    </UCard>

    <UAlert
      v-if="submitError"
      color="error"
      variant="subtle"
      :title="submitError"
    />

    <UButton
      :loading="submitting"
      @click="onSubmit"
    >
      Initiate session
    </UButton>
  </div>
</template>
