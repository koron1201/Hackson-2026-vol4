<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const router = useRouter()
const store = useQuestStore()
const currentTime = ref(new Date())
const audioStarted = ref(false)
const emergencyAvailable = ref(false)
const emergencyProgress = ref(0)
let timeTimer: ReturnType<typeof setInterval> | undefined
let emergencyTimer: ReturnType<typeof setInterval> | undefined
let audioContext: AudioContext | undefined
let oscillator: OscillatorNode | undefined
let gain: GainNode | undefined
let wakeLock: WakeLockSentinel | undefined

const timeText = computed(() =>
  currentTime.value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
)

async function startAlarm() {
  if (audioStarted.value) return
  audioStarted.value = true
  audioContext = new AudioContext()
  oscillator = audioContext.createOscillator()
  gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 640
  gain.gain.value = 0.12
  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start()
  navigator.vibrate?.([400, 200, 400])
  try {
    wakeLock = await navigator.wakeLock?.request('screen')
  } catch {
    // Wake Lock非対応でもアラーム画面は継続する。
  }
}

function stopAlarm() {
  oscillator?.stop()
  audioContext?.close()
  navigator.vibrate?.(0)
  void wakeLock?.release()
}

function scan() {
  stopAlarm()
  const target = store.tasks.find((task) => task.requiredPlace === 'WASHROOM' && task.status === 'TODO')
  if (target) void router.push({ path: '/scanner', query: { taskId: target.id, alarm: '1' } })
  else void router.push({ path: '/scanner', query: { taskId: store.nextTask?.id } })
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
  stopAlarm()
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
