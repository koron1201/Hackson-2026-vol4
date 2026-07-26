<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QuestTask } from '../domain/types'
import { useRouter } from 'vue-router'
import TaskCard from '@/components/TaskCard.vue'
import { useQuestStore } from '@/stores/quest'
import type { TaskStatus } from '../domain/types'

const store = useQuestStore()
const router = useRouter()
const filter = ref<'ALL' | TaskStatus>('ALL')

const filters: { value: 'ALL' | TaskStatus; label: string }[] = [
  { value: 'ALL', label: 'すべて' },
  { value: 'TODO', label: '未着手' },
  { value: 'STARTED', label: '着手済み' },
  { value: 'DONE', label: '完了' },
]

const filteredTasks = computed(() =>
  filter.value === 'ALL'
    ? store.tasks
    : store.tasks.filter((task: QuestTask) => task.status === filter.value),
)

async function handleStart(taskId: string) {
  const task = store.tasks.find((item: QuestTask) => item.id === taskId)
  if (!task) return
  if (task.requiredPlace === 'NONE') await store.startTask(taskId)
  else void router.push({ path: '/scanner', query: { taskId } })
}

async function handleComplete(taskId: string) {
  await store.completeTask(taskId)
}
</script>

<template>
  <div class="page">
    <section class="page-title">
      <div>
        <p class="eyebrow">DAILY QUESTS</p>
        <h1>今日のクエスト</h1>
        <p>ひとつずつ、着実に進めよう。</p>
      </div>
      <div class="mini-progress">
        <strong>{{ store.progress.percentage }}%</strong>
        <span>達成</span>
      </div>
    </section>

    <section class="forecast-strip" :data-risk="store.forecast.riskLevel">
      <span class="forecast-strip__icon" aria-hidden="true">◷</span>
      <div>
        <strong>就寝見込み 23:45</strong>
        <p>残り{{ store.forecast.remainingMinutes }}分 / 使える{{ store.forecast.effectiveAvailableMinutes }}分</p>
      </div>
      <span class="risk-badge" :data-risk="store.forecast.riskLevel">{{ store.forecast.riskLevel }}</span>
    </section>

    <div class="filter-tabs" role="tablist" aria-label="クエストの状態">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="filter === item.value"
        :class="{ active: filter === item.value }"
        @click="filter = item.value"
      >
        {{ item.label }}
        <span>{{ item.value === 'ALL' ? store.tasks.length : store.tasks.filter((task) => task.status === item.value).length }}</span>
      </button>
    </div>

    <section class="task-list" aria-live="polite">
        <TaskCard
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        @start="handleStart"
        @complete="handleComplete"
      />
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <span aria-hidden="true">✦</span>
        <h2>ここにはクエストがありません</h2>
        <p>別のフィルターを選ぶか、明日の計画を作りましょう。</p>
      </div>
    </section>

    <RouterLink class="floating-add" to="/plan" aria-label="クエストを追加">＋</RouterLink>
  </div>
</template>
