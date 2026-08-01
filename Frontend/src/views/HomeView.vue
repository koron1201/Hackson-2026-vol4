<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProgressRing from '@/components/ProgressRing.vue'
import { formatMinutes, minutesUntilClock, phaseFromHour } from '@/domain/quest'
import { useQuestStore } from '@/stores/quest'

const store = useQuestStore()
const router = useRouter()
const now = ref(new Date())
let timerId: number | undefined

const phase = computed(() => {
  if (store.phaseOverride) return store.phaseOverride
  return phaseFromHour(new Date(store.clockTick).getHours())
})

const phaseLabel = {
  night: '夜',
  morning: '朝',
  daytime: '日中',
}

const greeting = computed(() => {
  const greetings = {
    night: 'こんばんは',
    morning: 'おはよう',
    daytime: 'こんにちは',
  }
  return greetings[phase.value]
})

const allTasksDone = computed(
  () => store.tasks.length > 0 && store.tasks.every((task) => task.status === 'DONE'),
)

const heroMessage = computed(() => {
  if (store.tasks.length === 0) return '今日の計画を作って、冒険の準備を始めよう！'
  if (!store.nextTask) {
    return allTasksDone.value
      ? '今日のノルマ達成！ 夜のバトルへ行こう。'
      : '今日はここまで。明日のクエストに備えよう！'
  }
  if (store.progress.percentage >= 80) return '今日のノルマ達成！ 夜のバトルへ行こう。'
  const remaining = store.progress.totalCount - store.progress.completedCount
  return remaining > 0 ? `あと${remaining}つ。次の一歩を一緒に進めよう！` : '今日もよく頑張ったね！'
})

const riskText = computed(() => {
  const labels = {
    LOW: '余裕あり',
    MEDIUM: '少し注意',
    HIGH: '予定を見直そう',
  }
  return labels[store.forecast.riskLevel]
})

const bedtimeCountdown = computed(() => {
  const remainingMinutes = minutesUntilClock(store.plan.sleepTime, now.value)
  return remainingMinutes > 0 ? `就寝まであと${formatMinutes(remainingMinutes)}` : '就寝時刻です'
})

const placeLabel = computed(() => {
  const labels = {
    WASHROOM: '洗面所',
    PC: 'PC前',
    ENTRANCE: '玄関',
    NONE: '場所指定なし',
  }
  return store.nextTask ? labels[store.nextTask.requiredPlace] : ''
})

const missionStatus = computed(() => (store.nextTask?.status === 'STARTED' ? '進行中' : '未着手'))

const missionHeading = computed(() => {
  if (store.nextTask) return '次にやること'
  if (store.tasks.length === 0) return '今日の計画を作ろう'
  return allTasksDone.value ? '本日のミッション完了' : '今日はここまで'
})

const missionCtaLabel = computed(() => {
  const task = store.nextTask
  if (!task) return ''
  if (task.status === 'STARTED') return 'タスク一覧で続ける'
  return task.requiredPlace === 'NONE' ? 'クエストを始める' : 'QRをスキャンする'
})

onMounted(() => {
  timerId = window.setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
})

async function openNextTask() {
  const task = store.nextTask
  if (!task) return
  if (task.status === 'STARTED') {
    void router.push('/tasks')
  } else if (task.requiredPlace === 'NONE') {
    await store.startTask(task.id)
  } else {
    void router.push({ path: '/scanner', query: { taskId: task.id } })
  }
}
</script>

<template>
  <div class="page home-page">
    <section class="welcome-row">
      <div>
        <p class="eyebrow">{{ new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }) }}</p>
        <h1>{{ greeting }}、{{ store.userName }}さん</h1>
      </div>
    </section>

    <section class="phase-switcher" aria-label="表示フェーズ">
      <button
        v-for="item in (['night', 'morning', 'daytime'] as const)"
        :key="item"
        type="button"
        :class="{ active: phase === item }"
        :aria-pressed="phase === item"
        @click="store.setPhaseOverride(item)"
      >
        {{ phaseLabel[item] }}
      </button>
      <span>表示のみ切り替え</span>
    </section>

    <div class="home-grid">
      <section class="card progress-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">TODAY</p>
            <h2>今日の進み具合</h2>
          </div>
          <RouterLink to="/tasks">すべて見る</RouterLink>
        </div>
        <div class="progress-card__body">
          <ProgressRing
            :percentage="store.progress.percentage"
            :completed="store.progress.completedCount"
            :total="store.progress.totalCount"
          />
          <div class="progress-stats">
            <div>
              <span class="stat-icon stat-icon--green" aria-hidden="true">✓</span>
              <div>
                <small>完了した重み</small>
                <strong>{{ store.progress.doneWeight }} / {{ store.progress.totalWeight }}</strong>
              </div>
            </div>
            <div>
              <span class="stat-icon stat-icon--orange" aria-hidden="true">◷</span>
              <div>
                <small>残り時間</small>
                <strong>約{{ store.forecast.remainingMinutes }}分</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card mission-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">DAILY MISSION</p>
            <h2>{{ missionHeading }}</h2>
          </div>
          <span v-if="store.nextTask" class="status-dot" :class="{ 'status-dot--started': store.nextTask.status === 'STARTED' }">{{ missionStatus }}</span>
        </div>
        <div v-if="store.nextTask" class="mission-card__content">
          <span class="quest-icon" aria-hidden="true">{{ store.nextTask.requiredPlace === 'PC' ? '▣' : '⌖' }}</span>
          <div>
            <h3>{{ store.nextTask.title }}</h3>
            <p>{{ placeLabel }} · {{ store.nextTask.estimatedMinutes }}分 · 重み{{ store.nextTask.weight }}</p>
          </div>
          <button class="button mission-card__cta" type="button" :aria-label="`${store.nextTask.title}：${missionCtaLabel}`" @click="openNextTask">
            {{ missionCtaLabel }}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <RouterLink v-else-if="store.tasks.length === 0" class="button mission-card__cta" to="/plan">計画を作る</RouterLink>
      </section>

      <section class="card forecast-card">
        <div>
          <p class="eyebrow">SLEEP FORECAST</p>
          <h2>就寝見込み</h2>
          <strong>{{ bedtimeCountdown }}</strong>
          <span class="risk-badge" :data-risk="store.forecast.riskLevel">{{ riskText }}</span>
          <p>残り{{ store.forecast.remainingMinutes }}分 / 使える{{ store.forecast.effectiveAvailableMinutes }}分</p>
        </div>
        <div class="moon-scene" aria-hidden="true">
          <span>☾</span>
          <i></i><i></i><i></i>
        </div>
      </section>

      <section class="companion-banner">
        <div class="companion-banner__copy">
          <span class="quest-chip">{{ phaseLabel[phase] }}のクエスト</span>
          <h2>{{ heroMessage }}</h2>
          <p v-if="store.nextTask">次は「{{ store.nextTask.title }}」 · {{ store.nextTask.estimatedMinutes }}分</p>
        </div>
        <div class="companion-banner__visual" aria-hidden="true">
          <div class="sun-orbit"></div>
          <img :src="'/assets/hero.png'" alt="" />
        </div>
      </section>

      <section v-if="store.backendEnabled" class="card backend-reward-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">BACKEND REWARD</p>
            <h2>獲得コイン</h2>
          </div>
          <strong>{{ store.game.coins }}</strong>
        </div>
        <p>タスク完了時にバックエンドから返された合計コインです。</p>
      </section>

      <section v-else class="battle-teaser">
        <div class="battle-teaser__enemy" aria-hidden="true">
          <img :src="'/assets/enemy-purple-ogre.png'" alt="" />
        </div>
        <div class="battle-teaser__body">
          <p class="eyebrow">TONIGHT'S BATTLE</p>
          <h2>{{ store.game.enemyName }}</h2>
          <div class="hp-row">
            <div class="hp-bar"><span :style="{ width: `${(store.game.enemyHp / store.game.enemyMaxHp) * 100}%` }"></span></div>
            <strong>{{ store.game.enemyHp }} / {{ store.game.enemyMaxHp }}</strong>
          </div>
          <p>使えるアイテム {{ store.availableItems.length }}個 · 連続{{ store.game.streakDays }}日</p>
        </div>
        <RouterLink class="button button--battle" to="/battle">夜のバトルへ</RouterLink>
      </section>
    </div>
  </div>
</template>
