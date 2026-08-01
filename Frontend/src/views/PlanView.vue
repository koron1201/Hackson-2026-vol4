<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { validatePlanDraft } from '@/domain/quest'
import { useQuestStore } from '@/stores/quest'
import type { PlaceType, TaskCategory } from '@/domain/types'

const store = useQuestStore()
const router = useRouter()
const wakeTime = ref(store.plan.wakeTime)
const sleepTime = ref(store.plan.sleepTime)
const newTask = ref('')
const newTaskPlace = ref<PlaceType>('NONE')
const newTaskMinutes = ref('')
const errors = ref<string[]>([])
const addingTask = ref(false)
const aiSuggested = ref(false)
const suggestion = ref<{ category: TaskCategory; source: 'AI' | 'RULE' } | null>(null)

const totalMinutes = computed(() =>
  store.tasks.reduce((total, task) => total + task.estimatedMinutes, 0),
)

async function addTask() {
  const title = newTask.value.trim()
  if (!title) {
    errors.value = ['タスク名を入力してください']
    return
  }
  const minutes = newTaskMinutes.value === '' ? undefined : Number(newTaskMinutes.value)
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 5 || minutes > 240)) {
    errors.value = ['所要時間は5〜240分の整数で入力してください']
    return
  }
  addingTask.value = true
  errors.value = []
  try {
    await store.addTask(title, newTaskPlace.value, minutes, suggestion.value?.category)
    newTask.value = ''
    newTaskPlace.value = 'NONE'
    newTaskMinutes.value = ''
    aiSuggested.value = false
    suggestion.value = null
  } catch {
    errors.value = ['タスクを登録できませんでした。通信状態を確認して再試行してください。']
  } finally {
    addingTask.value = false
  }
}

async function suggestWithRules() {
  const title = newTask.value.trim()
  if (!title) {
    errors.value = ['AI提案を受けるタスク名を入力してください']
    return
  }
  addingTask.value = true
  errors.value = []
  try {
    const result = await store.suggestTask(title, newTaskPlace.value)
    newTaskPlace.value = result.requiredPlace
    newTaskMinutes.value = String(result.estimatedMinutes)
    suggestion.value = { category: result.category, source: result.source }
  } catch {
    errors.value = ['AI提案を取得できませんでした。内容を入力して通常追加できます。']
  } finally {
    addingTask.value = false
  }
}

function markSuggestionsForReview() {
  aiSuggested.value = true
  errors.value = []
}

async function save() {
  errors.value = validatePlanDraft({
    wakeTime: wakeTime.value,
    sleepTime: sleepTime.value,
    taskTitles: store.tasks.map((task) => task.title),
  })
  if (errors.value.length > 0) return

  await store.savePlan(wakeTime.value, sleepTime.value)
  void router.push('/home')
}

async function removeTask(taskId: string) {
  const task = store.tasks.find((item) => item.id === taskId)
  const title = task?.title ?? 'このタスク'
  if (!confirm(`${title} を削除してよいですか？`)) return
  await store.removeTask(taskId)
}
</script>

<template>
  <div class="page plan-page">
    <section class="page-title">
      <div>
        <p class="eyebrow">TOMORROW'S PLAN</p>
        <h1>明日の冒険を準備</h1>
        <p>夜のうちに決めて、朝は迷わず動き出そう。</p>
      </div>
    </section>

    <form class="plan-layout" @submit.prevent="save">
      <div class="plan-main">
        <section class="card time-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">TIME</p>
              <h2>睡眠と起床</h2>
            </div>
            <span>Asia/Tokyo</span>
          </div>
          <div class="time-fields">
            <label>
              <span>就寝目標</span>
              <input v-model="sleepTime" type="time" required />
            </label>
            <span aria-hidden="true">→</span>
            <label>
              <span>起床時刻</span>
              <input v-model="wakeTime" type="time" required />
            </label>
          </div>
        </section>

        <section class="card plan-tasks">
          <div class="section-heading">
            <div>
              <p class="eyebrow">QUESTS</p>
              <h2>明日のクエスト</h2>
            </div>
            <button class="text-button" type="button" @click="markSuggestionsForReview">
              ✦ AIでまとめて提案
            </button>
          </div>

          <div v-for="task in store.tasks" :key="task.id" class="plan-task-row">
            <span class="drag-handle" aria-hidden="true">⠿</span>
            <div>
              <strong>{{ task.title }}</strong>
              <span>
                {{ task.estimatedMinutes }}分 · ★{{ task.weight }} ·
                {{ task.requiredPlace === 'NONE' ? 'QRなし' : task.requiredPlace }}
              </span>
              <small v-if="aiSuggested && task.taskType === 'DAILY'">AI候補 · 保存前に確認してください</small>
            </div>
            <button type="button" class="icon-button" :aria-label="`${task.title}を削除`" @click="removeTask(task.id)">
              ×
            </button>
          </div>

          <div class="add-task-panel">
            <label>
              <span>新しいクエスト</span>
              <input v-model="newTask" maxlength="120" placeholder="例：企画書の構成を書く" />
            </label>
            <label>
              <span>開始場所</span>
              <select v-model="newTaskPlace">
                <option value="NONE">QRなし</option>
                <option value="PC">PC前</option>
                <option value="WASHROOM">洗面所</option>
                <option value="ENTRANCE">玄関</option>
              </select>
            </label>
            <label>
              <span>所要時間（分）</span>
              <input v-model="newTaskMinutes" type="number" min="5" max="240" step="5" placeholder="AI/既定値" />
            </label>
            <button
              v-if="store.backendEnabled"
              class="button button--outline"
              type="button"
              :disabled="addingTask"
              @click="suggestWithRules"
            >
              AIで提案
            </button>
            <button class="button button--outline" type="button" :disabled="addingTask" @click="addTask">
              {{ addingTask ? '登録中…' : '＋ 追加する' }}
            </button>
            <p v-if="suggestion" class="helper-text">
              {{ suggestion.source === 'AI' ? 'AI候補' : 'ルール候補（AIなし）' }}：{{ suggestion.category }}
              · 内容は追加前に編集できます。
            </p>
          </div>
        </section>
      </div>

      <aside class="plan-summary">
        <div class="card">
          <p class="eyebrow">PLAN SUMMARY</p>
          <h2>この計画の見込み</h2>
          <dl>
            <div><dt>クエスト数</dt><dd>{{ store.tasks.length }}件</dd></div>
            <div><dt>合計時間</dt><dd>{{ totalMinutes }}分</dd></div>
            <div><dt>予想終了</dt><dd>23:20</dd></div>
          </dl>
          <div class="plan-health">
            <span aria-hidden="true">✓</span>
            <p><strong>無理のない計画です</strong>就寝準備の30分も確保しています。</p>
          </div>
        </div>
        <ul v-if="errors.length" class="form-errors" role="alert">
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
        <button class="button button--wide" type="submit">計画を保存してアラーム設定</button>
        <p class="helper-text">
          {{ store.backendEnabled ? '計画はバックエンドにも保存します。' : 'Webアラームと計画時刻は端末内に保存します。' }}
        </p>
      </aside>
    </form>
  </div>
</template>
