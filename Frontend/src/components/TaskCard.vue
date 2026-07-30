<script setup lang="ts">
import { computed } from 'vue'
import type { QuestTask } from '../domain/types'

const props = defineProps<{ task: QuestTask }>()
const emit = defineEmits<{
  start: [taskId: string]
  complete: [taskId: string]
}>()

const statusLabel = computed(() => {
  const labels = {
    TODO: '未着手',
    STARTED: '着手済み',
    DONE: '完了',
    SKIPPED: 'スキップ',
  }
  return labels[props.task.status]
})

const placeLabel = computed(() => {
  const labels = {
    WASHROOM: '洗面所',
    PC: 'PC前',
    ENTRANCE: '玄関',
    NONE: 'QRなし',
  }
  return labels[props.task.requiredPlace]
})
</script>

<template>
  <article class="task-card" :class="`task-card--${task.status.toLowerCase()}`">
    <div class="task-card__status-row">
      <span class="status-pill" :data-status="task.status">{{ statusLabel }}</span>
      <span class="task-card__meta">★{{ task.weight }} · {{ task.estimatedMinutes }}分</span>
    </div>
    <h3>{{ task.title }}</h3>
    <div class="task-card__footer">
      <span class="place-label">
        <span aria-hidden="true">{{ task.requiredPlace === 'NONE' ? '○' : '⌖' }}</span>
        {{ placeLabel }}
      </span>
      <button
        v-if="task.status === 'TODO'"
        class="button button--small button--outline"
        type="button"
        @click="emit('start', task.id)"
      >
        {{ task.requiredPlace === 'NONE' ? '開始する' : 'QRで開始' }}
      </button>
      <button
        v-else-if="task.status === 'STARTED'"
        class="button button--small"
        type="button"
        @click="emit('complete', task.id)"
      >
        完了する
      </button>
      <span v-else-if="task.status === 'DONE'" class="done-mark" aria-label="完了">✓</span>
    </div>
  </article>
</template>
