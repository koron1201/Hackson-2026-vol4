<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useQuestStore } from '@/stores/quest'
import type { QuestTask } from '@/domain/types'
import { stopAlarmAudio } from '@/services/alarmAudio'

const route = useRoute()
const router = useRouter()
const store = useQuestStore()
const videoElement = ref<HTMLVideoElement | null>(null)
const status = ref<'idle' | 'starting' | 'scanning' | 'error' | 'success'>('idle')
const errorMessage = ref('')
const scannedOnce = ref(false)
const heroImageSrc = '/assets/hero.png'
let controls: IScannerControls | undefined
let controlsStopped = false
let cameraStartGeneration = 0
let successTimer: number | undefined
let disposed = false

const taskId = computed(() => String(route.query.taskId ?? ''))
const task = computed(() => store.tasks.find((item: QuestTask) => item.id === taskId.value))
const unfinishedTaskCount = computed(
  () => store.tasks.filter((item) => item.status !== 'DONE' && item.status !== 'SKIPPED').length,
)
const placeLabel = computed(() => {
  const labels = { WASHROOM: '洗面所', PC: 'PC前', ENTRANCE: '玄関', NONE: '指定場所' }
  return task.value ? labels[task.value.requiredPlace] : '指定場所'
})

function stopCamera() {
  if (!controls || controlsStopped) return
  controlsStopped = true
  controls.stop()
}

function stopLateControls(lateControls: IScannerControls) {
  lateControls.stop()
}

function shouldDiscardCameraStart(generation: number) {
  return disposed || generation !== cameraStartGeneration || status.value === 'success'
}

async function startCamera() {
  if (!task.value || !videoElement.value) {
    status.value = 'error'
    errorMessage.value = '対象クエストが見つかりません。'
    return
  }

  status.value = 'starting'
  errorMessage.value = ''
  const generation = ++cameraStartGeneration
  const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 180 })

  try {
    const devices = await BrowserQRCodeReader.listVideoInputDevices()
    if (shouldDiscardCameraStart(generation)) return
    const rearCamera =
      [...devices].reverse().find((device) => /back|rear|environment|背面/i.test(device.label)) ??
      devices.at(-1)

    const nextControls = await reader.decodeFromVideoDevice(
      rearCamera?.deviceId,
      videoElement.value,
      (result) => {
        if (result && !scannedOnce.value) void verify(result.getText())
      },
    )
    if (shouldDiscardCameraStart(generation)) {
      stopLateControls(nextControls)
      return
    }
    controls = nextControls
    controlsStopped = false
    status.value = 'scanning'
  } catch {
    if (shouldDiscardCameraStart(generation)) return
    status.value = 'error'
    errorMessage.value =
      'カメラを開始できませんでした。ブラウザ設定でカメラを許可するか、デモ操作をお試しください。'
  }
}

async function verify(rawToken: string) {
  if (!task.value || scannedOnce.value || disposed || status.value === 'success') return
  scannedOnce.value = true

  // 生のQR値はログ・ストレージへ保存せず、照合処理へ一時的に渡すだけにする。
  let outcome: Awaited<ReturnType<typeof store.verifyQrForTaskWithOutcome>>
  try {
    outcome = await store.verifyQrForTaskWithOutcome(rawToken, task.value.id)
  } catch {
    if (disposed) return
    scannedOnce.value = false
    errorMessage.value = 'QRコードを確認できませんでした。もう一度お試しください。'
    return
  }
  if (disposed) return
  if (outcome === 'UNAVAILABLE') {
    scannedOnce.value = false
    errorMessage.value =
      'QRコードを確認できませんでした。通信状態を確認して、もう一度お試しください。'
    return
  }
  if (outcome === 'MISMATCH') {
    scannedOnce.value = false
    errorMessage.value = `${placeLabel.value}のQRではありません。`
    navigator.vibrate?.([100, 60, 100])
    return
  }

  status.value = 'success'
  errorMessage.value = ''
  stopCamera()
  if (route.query.alarm === '1') stopAlarmAudio()
  navigator.vibrate?.(120)
  successTimer = window.setTimeout(() => {
    successTimer = undefined
    if (!disposed && status.value === 'success') void router.replace('/tasks')
  }, 2_800)
}

function cancel() {
  stopCamera()
  void router.back()
}

function openArSummon() {
  if (successTimer !== undefined) {
    window.clearTimeout(successTimer)
    successTimer = undefined
  }
  void router.push({ path: '/ar-summon', query: { taskId: task.value?.id ?? '' } })
}

onMounted(() => void startCamera())
onBeforeUnmount(() => {
  disposed = true
  cameraStartGeneration += 1
  if (successTimer !== undefined) {
    window.clearTimeout(successTimer)
    successTimer = undefined
  }
  stopCamera()
})
</script>

<template>
  <div class="scanner-page">
    <header class="immersive-header">
      <button class="icon-button icon-button--glass" type="button" aria-label="戻る" @click="cancel">←</button>
      <strong>QRをスキャン</strong>
      <span class="secure-camera">{{ store.backendEnabled ? 'サーバー照合' : '端末内処理' }}</span>
    </header>

    <section v-if="status !== 'success'" class="scanner-copy">
      <p class="eyebrow">QUEST START</p>
      <h1>{{ placeLabel }}のQRを映してください</h1>
      <p v-if="task">「{{ task.title }}」を始める合図にします。</p>
    </section>

    <div class="camera-stage" :class="{ 'camera-stage--success': status === 'success' }">
      <video ref="videoElement" muted playsinline></video>
      <div v-if="status !== 'success'" class="scan-frame" aria-hidden="true">
        <i></i><i></i><i></i><i></i><span></span>
      </div>
      <div v-if="status === 'starting'" class="camera-loading">カメラを準備中…</div>
      <div v-if="status === 'success'" class="scan-success" role="status" aria-live="polite">
        <div class="scan-success__glow" aria-hidden="true"></div>
        <div class="scan-success__stars" aria-hidden="true">
          <span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span>
        </div>
        <img class="scan-success__hero" :src="heroImageSrc" alt="" />
        <div class="scan-success__message">
          <span class="scan-success__badge" aria-hidden="true">✓</span>
          <p class="scan-success__eyebrow">読み取り成功</p>
          <strong>「{{ task?.title }}」を開始</strong>
          <p>いいスタート！ この調子で一歩ずつ進めよう。</p>
          <p class="scan-success__remaining">今日の未完了 <b>{{ unfinishedTaskCount }}件</b></p>
          <button class="button scan-success__ar-button" type="button" @click="openArSummon">
            ARでキャラを召喚
          </button>
          <p class="scan-success__next">約3秒後にタスク一覧へ進みます</p>
        </div>
      </div>
    </div>

    <p v-if="status !== 'success' && errorMessage" class="scanner-error" role="alert">{{ errorMessage }}</p>
    <div v-if="status !== 'success'" class="scanner-actions">
      <button
        v-if="!store.backendEnabled"
        class="button button--wide button--light"
        type="button"
        @click="verify('demo')"
      >
        デモ用QRで続ける
      </button>
      <button v-if="status === 'error'" class="text-button text-button--light" type="button" @click="startCamera">
        カメラをもう一度試す
      </button>
    </div>
    <p class="camera-privacy">
      カメラ映像は送信・保存しません。APIモードでは読み取ったQR文字列だけを照合用に送信します。
    </p>
  </div>
</template>
