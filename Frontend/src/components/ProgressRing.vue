<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  percentage: number
  completed: number
  total: number
}>()

const normalized = computed(() => Math.min(100, Math.max(0, Math.round(props.percentage))))
const ringStyle = computed(() => ({
  '--progress': `${normalized.value * 3.6}deg`,
}))
</script>

<template>
  <div
    class="progress-ring"
    :style="ringStyle"
    role="progressbar"
    aria-label="今日のクエスト達成率"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="normalized"
  >
    <div class="progress-ring__inner">
      <strong>{{ normalized }}%</strong>
      <span>{{ completed }} / {{ total }} 完了</span>
    </div>
  </div>
</template>
