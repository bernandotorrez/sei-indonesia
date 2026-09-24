<script setup>
const props = defineProps({
  status: { type: String, required: true }
})

const STYLES = {
  OPEN: { color: 'neutral', label: 'Open' },
  SUBMITTED: { color: 'warning', label: 'Submitted' },
  APPROVING: { color: 'info', label: 'Approving…' },
  APPROVED: { color: 'success', label: 'Approved' },
  REJECTED: { color: 'error', label: 'Rejected' }
}

const style = computed(() => STYLES[props.status] || { color: 'neutral', label: props.status })
</script>

<template>
  <UBadge
    :color="style.color"
    variant="subtle"
  >
    {{ style.label }}
  </UBadge>
</template>
