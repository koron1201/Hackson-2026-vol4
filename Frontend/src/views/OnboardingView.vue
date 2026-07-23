<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const router = useRouter()
const store = useQuestStore()
const step = ref(1)
const wakeTime = ref('07:00')
const sleepTime = ref('23:30')

function next() {
  if (step.value < 3) step.value += 1
  else {
    store.savePlan(wakeTime.value, sleepTime.value)
    store.setOnboardingCompleted(true)
    void router.replace('/home')
  }
}
</script>

<template>
  <div class="onboarding-page">
    <header>
      <div class="brand"><span class="brand__sun" aria-hidden="true">☀</span><span>Morning<span>Quest</span></span></div>
      <span>ステップ {{ step }} / 3</span>
    </header>
    <main>
      <div class="step-dots" aria-label="オンボーディングの進捗">
        <i v-for="index in 3" :key="index" :class="{ active: index <= step }"></i>
      </div>

      <section v-if="step === 1" class="onboarding-card">
        <div class="onboarding-visual" aria-hidden="true">☾ <span>→</span> ☀ <span>→</span> ⚔</div>
        <p class="eyebrow">HOW IT WORKS</p>
        <h1>一日をクエストに変えよう</h1>
        <p>夜に計画し、朝は指定場所のQRで起床。日中の達成が夜のアイテムになります。</p>
      </section>

      <section v-else-if="step === 2" class="onboarding-card">
        <p class="eyebrow">YOUR RHYTHM</p>
        <h1>生活リズムを設定</h1>
        <p>端末のタイムゾーンで表示します。あとから設定画面で変更できます。</p>
        <div class="time-fields time-fields--stack">
          <label><span>いつもの就寝時刻</span><input v-model="sleepTime" type="time" /></label>
          <label><span>いつもの起床時刻</span><input v-model="wakeTime" type="time" /></label>
        </div>
      </section>

      <section v-else class="onboarding-card">
        <p class="eyebrow">DEVICE CHECK</p>
        <h1>端末の準備を確認</h1>
        <p>Web版ではページを前面表示中にアラームが動きます。通知は補助機能です。</p>
        <ul class="device-checks">
          <li><span>✓</span><div><strong>HTTPS / localhost</strong><small>カメラを安全に利用できます</small></div></li>
          <li><span>✓</span><div><strong>カメラ</strong><small>映像は端末内だけで処理します</small></div></li>
          <li><span>!</span><div><strong>通知</strong><small>拒否してもコア機能は利用できます</small></div></li>
        </ul>
      </section>
      <button class="button button--wide" type="button" @click="next">
        {{ step === 3 ? '冒険を始める' : '次へ' }}
      </button>
    </main>
  </div>
</template>
