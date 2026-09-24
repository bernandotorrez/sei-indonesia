<script setup>
const api = useApi()
const { data: products, pending, error, refresh } = await useAsyncData('manager-products', () => api.get('/products'))

const form = reactive({ sku: '', name: '', onHandQty: 0 })
const creating = ref(false)
const createError = ref('')

async function onCreate() {
  createError.value = ''
  creating.value = true
  try {
    await api.post('/products', { ...form, onHandQty: Number(form.onHandQty) })
    form.sku = ''
    form.name = ''
    form.onHandQty = 0
    await refresh()
  } catch (err) {
    createError.value = err.message
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold">
      Products
    </h1>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Add product
        </h2>
      </template>

      <form
        class="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        @submit.prevent="onCreate"
      >
        <UFormField
          label="SKU"
          class="sm:col-span-1"
        >
          <UInput
            v-model="form.sku"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Name"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.name"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Initial qty"
          class="sm:col-span-1"
        >
          <UInput
            v-model="form.onHandQty"
            type="number"
            min="0"
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
              SKU
            </th>
            <th class="px-4 py-2 text-left font-medium text-gray-500">
              Name
            </th>
            <th class="px-4 py-2 text-right font-medium text-gray-500">
              On hand
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="product in products"
            :key="product.id"
          >
            <td class="px-4 py-2 font-mono text-xs">
              {{ product.sku }}
            </td>
            <td class="px-4 py-2">
              {{ product.name }}
            </td>
            <td class="px-4 py-2 text-right">
              {{ product.on_hand_qty }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
