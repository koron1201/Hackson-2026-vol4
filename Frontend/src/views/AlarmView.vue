<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'
import { isAlarmAudioActive, startAlarmAudio, stopAlarmAudio } from '@/services/alarmAudio'

const router = useRouter()
const store = useQuestStore()
const currentTime = ref(new Date())
const audioStarted = ref(false)
const emergencyAvailable = ref(false)
const emergencyProgress = ref(0)
let timeTimer: ReturnType<typeof setInterval> | undefined
let emergencyTimer: ReturnType<typeof setInterval> | undefined

const timeText = computed(() =>
  currentTime.value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
)

async function startAlarm() {
  audioStarted.value = await startAlarmAudio()
}

function stopAlarm() {
  stopAlarmAudio()
  audioStarted.value = false
}

function scan() {
  const target =
    store.tasks.find((task) => task.requiredPlace === 'WASHROOM' && task.status === 'TODO') ??
    store.nextTask
  if (target) void router.push({ path: '/scanner', query: { taskId: target.id, alarm: '1' } })
  else store.toast = '解除するタスクが見つかりません。計画を確認してください。'
}

function beginEmergencyHold() {
  if (!emergencyAvailable.value || emergencyTimer) return
  const startedAt = Date.now()
  emergencyTimer = window.setInterval(() => {
    emergencyProgress.value = Math.min(100, ((Date.now() - startedAt) / 3000) * 100)
    if (emergencyProgress.value >= 100) {
      cancelEmergencyHold()
      stopAlarm()
      void router.replace('/home')
    }
  }, 50)
}

function cancelEmergencyHold() {
  if (emergencyTimer) clearInterval(emergencyTimer)
  emergencyTimer = undefined
  emergencyProgress.value = 0
}

onMounted(() => {
  audioStarted.value = isAlarmAudioActive()
  timeTimer = window.setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
  window.setTimeout(() => {
    emergencyAvailable.value = true
  }, 60_000)
})

onBeforeUnmount(() => {
  if (timeTimer) clearInterval(timeTimer)
  cancelEmergencyHold()
})
</script>

<template>
  <div class="alarm-page">
    <div class="alarm-glow" aria-hidden="true"></div>
    <header>
      <span class="alarm-live"><i></i> アラーム</span>
      <span>MorningQuest</span>
    </header>
    <main>
      <p>おはようございます</p>
      <h1>{{ timeText }}</h1>
      <h2>洗面所へ向かおう！</h2>
      <p>QRを読み取るまで、今日の冒険は始まりません。</p>

      <button v-if="!audioStarted" class="alarm-start" type="button" @click="startAlarm">
        <span aria-hidden="true">♪</span>
        <strong>アラーム音を開始</strong>
        <small>ブラウザの音声許可が必要です</small>
      </button>

      <button class="scan-orb" type="button" @click="scan">
        <span class="scan-orb__corners" aria-hidden="true">⌗</span>
        <strong>QRをスキャン</strong>
        <small>洗面所のQR</small>
      </button>

      <div class="alarm-status">
        <span aria-hidden="true">◖)))</span> 音量 ON
        <span aria-hidden="true">⌁</span> 振動 ON
      </div>
    </main>
    <footer>
      <button
        class="emergency-button"
        type="button"
        :disabled="!emergencyAvailable"
        @pointerdown="beginEmergencyHold"
        @pointerup="cancelEmergencyHold"
        @pointerleave="cancelEmergencyHold"
      >
        <span :style="{ width: `${emergencyProgress}%` }"></span>
        {{ emergencyAvailable ? '緊急停止（3秒長押し・報酬なし）' : '問題がある場合は60秒後に緊急停止できます' }}
      </button>
    </footer>
  </div>
</template>
