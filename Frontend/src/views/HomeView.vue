<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProgressRing from '@/components/ProgressRing.vue'
import { formatMinutes, minutesUntilClock } from '@/domain/quest'
import { useQuestStore } from '@/stores/quest'

const store = useQuestStore()
const router = useRouter()
const now = ref(new Date())
let timerId: number | undefined

const phase = computed(() => {
  if (store.phaseOverride) return store.phaseOverride
  const hour = new Date().getHours()
  if (hour < 9) return 'morning'
  if (hour >= 20) return 'night'
  return 'daytime'
})

const phaseLabel = {
  night: '夜',
  morning: '朝',
  daytime: '日中',
}

const heroMessage = computed(() => {
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
        <h1>おはよう、{{ store.userName }}さん</h1>
      </div>
      <button class="notification-button" type="button" aria-label="通知履歴">
        ♢
        <span>2</span>
      </button>
    </section>

    <section class="phase-switcher" aria-label="表示フェーズ">
      <button
        v-for="item in (['night', 'morning', 'daytime'] as const)"
        :key="item"
        type="button"
        :class="{ active: phase === item }"
        @click="store.setPhaseOverride(item)"
      >
        {{ phaseLabel[item] }}
      </button>
      <span>表示のみ切り替え</span>
    </section>

    <div class="home-grid">
      <section class="hero-card">
        <div class="hero-card__copy">
          <span class="quest-chip">{{ phaseLabel[phase] }}のクエスト</span>
          <h2>{{ heroMessage }}</h2>
          <p v-if="store.nextTask">
            次は「{{ store.nextTask.title }}」 · {{ store.nextTask.estimatedMinutes }}分
          </p>
          <button class="button button--hero" type="button" :disabled="!store.nextTask" @click="openNextTask">
            {{ store.nextTask?.requiredPlace === 'NONE' ? 'クエストを始める' : 'QRをスキャンする' }}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div class="hero-card__visual" aria-hidden="true">
          <div class="sun-orbit"></div>
          <img src="/assets/hero.png" alt="" />
        </div>
      </section>

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

      <section class="card next-card" v-if="store.nextTask">
        <div class="section-heading">
          <div>
            <p class="eyebrow">NEXT QUEST</p>
            <h2>次にやること</h2>
          </div>
          <span class="status-dot">未着手</span>
        </div>
        <div class="next-card__content">
          <span class="quest-icon" aria-hidden="true">{{ store.nextTask.requiredPlace === 'PC' ? '▣' : '⌖' }}</span>
          <div>
            <h3>{{ store.nextTask.title }}</h3>
            <p>★{{ store.nextTask.weight }} · {{ store.nextTask.estimatedMinutes }}分 · QR {{ store.nextTask.requiredPlace }}</p>
          </div>
          <button class="button button--square" type="button" @click="openNextTask" aria-label="このクエストを開始">→</button>
        </div>
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

      <section v-if="store.backendEnabled" class="card next-card">
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
        <div class="battle-teaser__enemy" aria-hidden="true">🧌</div>
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
