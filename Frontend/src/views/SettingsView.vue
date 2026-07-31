<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const router = useRouter()
const store = useQuestStore()
const notificationsEnabled = ref(Notification.permission === 'granted')
const cameraStatus = ref<'unknown' | 'available' | 'denied'>('unknown')

async function requestNotifications() {
  if (!('Notification' in window)) return
  const result = await Notification.requestPermission()
  notificationsEnabled.value = result === 'granted'
}

async function checkCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach((track) => track.stop())
    cameraStatus.value = 'available'
  } catch {
    cameraStatus.value = 'denied'
  }
}

function resetLocalData() {
  store.resetDemo()
  store.toast = 'この端末の保存データを初期化しました'
  if (store.backendEnabled) void router.replace('/login')
}

function logout() {
  store.setAuthenticated(false)
  void router.replace('/login')
}
</script>

<template>
  <div class="page settings-page">
    <section class="page-title">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>設定</h1>
        <p>アラーム、QR、端末の状態を確認できます。</p>
      </div>
    </section>

    <div class="settings-grid">
      <section class="card settings-profile">
        <div class="avatar"><img src="/assets/hero.png" alt="" /></div>
        <div><h2>{{ store.userName }}</h2><p>冒険者 Lv.{{ store.game.level }} · 連続{{ store.game.streakDays }}日</p></div>
        <button class="button button--small button--outline" type="button">編集</button>
      </section>

      <section class="card settings-section">
        <div class="section-heading"><div><p class="eyebrow">ALARM</p><h2>時刻と通知</h2></div></div>
        <div class="setting-row"><div><strong>既定の起床時刻</strong><p>毎日の初期値</p></div><span>{{ store.plan.wakeTime }}</span></div>
        <div class="setting-row"><div><strong>既定の就寝時刻</strong><p>就寝見込みの基準</p></div><span>{{ store.plan.sleepTime }}</span></div>
        <div class="setting-row">
          <div><strong>ブラウザ通知</strong><p>起床・見込み変化の補助通知</p></div>
          <button class="button button--small button--outline" type="button" @click="requestNotifications">
            {{ notificationsEnabled ? '許可済み' : '許可する' }}
          </button>
        </div>
      </section>

      <section class="card settings-section">
        <div class="section-heading"><div><p class="eyebrow">QR PLACES</p><h2>登録場所</h2></div></div>
        <div class="qr-place"><span aria-hidden="true">◫</span><div><strong>洗面所</strong><p>朝のアラーム解除</p></div><em>有効</em></div>
        <div class="qr-place"><span aria-hidden="true">▣</span><div><strong>PC前</strong><p>集中タスクの開始</p></div><em>有効</em></div>
        <div class="qr-place"><span aria-hidden="true">⌂</span><div><strong>玄関</strong><p>外出・運動の開始</p></div><em>有効</em></div>
        <p class="helper-text">
          現在のバックエンドは、WASHROOM・DESK・ENTRANCEという文字列の一致で照合します。
        </p>
      </section>

      <section class="card settings-section">
        <div class="section-heading"><div><p class="eyebrow">DEVICE</p><h2>端末診断</h2></div></div>
        <div class="setting-row"><div><strong>カメラ</strong><p>QR読み取りの権限</p></div><button class="button button--small button--outline" type="button" @click="checkCamera">{{ cameraStatus === 'available' ? '利用可能' : cameraStatus === 'denied' ? '要確認' : '確認する' }}</button></div>
        <div class="setting-row"><div><strong>ネットワーク</strong><p>現在の接続状態</p></div><span>{{ store.isOffline ? 'オフライン' : 'オンライン' }}</span></div>
        <RouterLink class="button button--outline button--wide" to="/alarm/demo">アラーム画面を試す</RouterLink>
      </section>

      <section class="card settings-section settings-section--danger">
        <h2>端末データと接続</h2>
        <button class="text-button" type="button" @click="resetLocalData">端末データを初期化</button>
        <button class="text-button text-button--danger" type="button" @click="logout">ログアウト</button>
      </section>
    </div>
  </div>
</template>
