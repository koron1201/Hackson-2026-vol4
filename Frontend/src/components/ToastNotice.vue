<script setup lang="ts">
import { watch } from 'vue'
import { useQuestStore } from '@/stores/quest'

const store = useQuestStore()
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => store.toast,
  (message) => {
    if (timer) clearTimeout(timer)
    if (message) timer = setTimeout(() => store.clearToast(), 2800)
  },
)
</script>

<template>
  <Transition name="toast">
    <div v-if="store.toast" class="toast-notice" role="status" aria-live="polite">
      <span aria-hidden="true">✦</span>
      {{ store.toast }}
    </div>
  </Transition>
</template>
