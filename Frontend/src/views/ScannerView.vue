<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useQuestStore } from '@/stores/quest'

const route = useRoute()
const router = useRouter()
const store = useQuestStore()
const videoElement = ref<HTMLVideoElement | null>(null)
const status = ref<'idle' | 'starting' | 'scanning' | 'error' | 'success'>('idle')
const errorMessage = ref('')
const scannedOnce = ref(false)
let controls: IScannerControls | undefined

const taskId = computed(() => String(route.query.taskId ?? ''))
const task = computed(() => store.tasks.find((item) => item.id === taskId.value))
const placeLabel = computed(() => {
  const labels = { WASHROOM: '洗面所', PC: 'PC前', ENTRANCE: '玄関', NONE: '指定場所' }
  return task.value ? labels[task.value.requiredPlace] : '指定場所'
})

async function startCamera() {
  if (!task.value || !videoElement.value) {
    status.value = 'error'
    errorMessage.value = '対象クエストが見つかりません。'
    return
  }

  status.value = 'starting'
  errorMessage.value = ''
  const reader = new BrowserQRCodeReader(undefined, {
    delayBetweenScanAttempts: 180,
  })

  try {
    const devices = await BrowserQRCodeReader.listVideoInputDevices()
    const rearCamera =
      [...devices].reverse().find((device) => /back|rear|environment|背面/i.test(device.label)) ??
      devices.at(-1)

    controls = await reader.decodeFromVideoDevice(
      rearCamera?.deviceId,
      videoElement.value,
      (result) => {
        if (result && !scannedOnce.value) void verify(result.getText())
      },
    )
    status.value = 'scanning'
  } catch {
    status.value = 'error'
    errorMessage.value =
      'カメラを開始できませんでした。ブラウザ設定でカメラを許可するか、デモ操作をお試しください。'
  }
}

async function verify(rawToken: string) {
  if (!task.value || scannedOnce.value) return
  scannedOnce.value = true

  // 生のQR値はログ・ストレージへ保存しない。
  if (!rawToken.startsWith('mq1_') && rawToken !== 'demo') {
    scannedOnce.value = false
    errorMessage.value = `${placeLabel.value}のQRではありません。`
    navigator.vibrate?.([100, 60, 100])
    return
  }

  controls?.stop()
  status.value = 'success'
  store.startTask(task.value.id)
  navigator.vibrate?.(120)
  window.setTimeout(() => void router.replace('/tasks'), 1200)
}

function cancel() {
  controls?.stop()
  void router.back()
}

onMounted(() => void startCamera())
onBeforeUnmount(() => controls?.stop())
</script>

<template>
  <div class="scanner-page">
    <header class="immersive-header">
      <button class="icon-button icon-button--glass" type="button" aria-label="戻る" @click="cancel">←</button>
      <strong>QRをスキャン</strong>
      <span class="secure-camera">端末内処理</span>
    </header>

    <section class="scanner-copy">
      <p class="eyebrow">QUEST START</p>
      <h1>{{ placeLabel }}のQRを映してください</h1>
      <p v-if="task">「{{ task.title }}」を始める合図にします。</p>
    </section>

    <div class="camera-stage">
      <video ref="videoElement" muted playsinline></video>
      <div class="scan-frame" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
        <span></span>
      </div>
      <div v-if="status === 'starting'" class="camera-loading">カメラを準備中…</div>
      <div v-if="status === 'success'" class="scan-success" role="status">
        <span aria-hidden="true">✓</span>
        <strong>読み取り成功！</strong>
        <p>クエストを開始しました</p>
      </div>
    </div>

    <p v-if="errorMessage" class="scanner-error" role="alert">{{ errorMessage }}</p>
    <div class="scanner-actions">
      <button class="button button--wide button--light" type="button" @click="verify('demo')">
        デモ用QRで続ける
      </button>
      <button v-if="status === 'error'" class="text-button text-button--light" type="button" @click="startCamera">
        カメラをもう一度試す
      </button>
    </div>
    <p class="camera-privacy">カメラ映像は端末の外へ送信・保存されません。</p>
  </div>
</template>
