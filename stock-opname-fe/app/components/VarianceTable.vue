<script setup>
defineProps({
  items: { type: Array, required: true },
  showDiscrepancy: { type: Boolean, default: true }
})

// The backend only persists `discrepancy_qty` once the reconciliation worker applies it
// post-approval (stock must not change on submission). The manager still needs to see the
// variance before approving, so derive it here from counted vs. expected whenever a persisted
// value isn't available yet.
function discrepancyOf(item) {
  if (item.discrepancy_qty !== null && item.discrepancy_qty !== undefined) return item.discrepancy_qty
  if (item.counted_qty === null || item.counted_qty === undefined) return null
  return item.counted_qty - item.expected_qty
}

function discrepancyClass(value) {
  if (value === null || value === undefined || value === 0) return 'text-gray-500'
  return value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}
</script>

<template>
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
            Counted
          </th>
          <th
            v-if="showDiscrepancy"
            class="px-4 py-2 text-right font-medium text-gray-500"
          >
            Discrepancy
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr
          v-for="item in items"
          :key="item.id"
        >
          <td class="px-4 py-2 font-mono text-xs">
            {{ item.product?.sku }}
          </td>
          <td class="px-4 py-2">
            {{ item.product?.name }}
          </td>
          <td class="px-4 py-2 text-right">
            {{ item.expected_qty }}
          </td>
          <td class="px-4 py-2 text-right">
            {{ item.counted_qty ?? '—' }}
          </td>
          <td
            v-if="showDiscrepancy"
            class="px-4 py-2 text-right font-medium"
            :class="discrepancyClass(discrepancyOf(item))"
          >
            <template v-if="discrepancyOf(item) !== null">
              {{ discrepancyOf(item) > 0 ? '+' : '' }}{{ discrepancyOf(item) }}
            </template>
            <template v-else>
              —
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
