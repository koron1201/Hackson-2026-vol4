<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const router = useRouter()
const store = useQuestStore()
const error = ref('')
const submitting = ref(false)

async function connectBackend() {
  error.value = ''
  submitting.value = true
  const connected = await store.connectBackend()
  submitting.value = false
  if (!connected) {
    error.value = 'バックエンドへ接続できません。起動状態と接続先を確認してください。'
    return
  }
  void router.replace('/home')
}

function useDemo() {
  store.setAuthenticated(true)
  void router.replace('/home')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-sun" aria-hidden="true">☀</div>
    <section class="auth-intro">
      <div class="brand brand--large">
        <span class="brand__sun" aria-hidden="true">☀</span>
        <span>Morning<span>Quest</span></span>
      </div>
      <h1>毎日の行動を、<br />小さな冒険に。</h1>
      <p>夜に決めて、朝はQRで始める。今日の達成が、夜のバトルで力になります。</p>
      <img :src="'/assets/hero.png'" alt="MorningQuestの冒険者キャラクター" />
    </section>
    <section class="auth-card">
      <template v-if="store.backendEnabled">
        <p class="eyebrow">API CONNECTION</p>
        <h2>バックエンドへ接続</h2>
        <p>バックエンドの起動を確認してから、クエスト管理を始めます。</p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button
          class="button button--wide"
          type="button"
          data-testid="connect-backend"
          :disabled="submitting"
          @click="connectBackend"
        >
          {{ submitting ? '接続確認中…' : '接続して始める' }}
        </button>
        <p class="auth-note">
          現在のバックエンドには認証APIがないため、固定ユーザーID 1を使用します。
        </p>
      </template>
      <template v-else>
        <p class="eyebrow">LOCAL DEMO</p>
        <h2>デモを始める</h2>
        <p>バックエンドへ送信せず、この端末内だけで主要画面を確認します。</p>
        <button class="button button--outline button--wide" type="button" @click="useDemo">
          デモモードで始める
        </button>
        <p class="auth-note">入力した認証情報を装うフォームは使用しません。</p>
      </template>
    </section>
  </div>
</template>
