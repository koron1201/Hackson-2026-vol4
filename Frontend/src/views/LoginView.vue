<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const router = useRouter()
const store = useQuestStore()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function login() {
  error.value = ''
  if (!email.value.includes('@') || password.value.length < 8) {
    error.value = 'メールアドレスと8文字以上のパスワードを入力してください。'
    return
  }
  submitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 350))
  store.setAuthenticated(true)
  submitting.value = false
  void router.replace(store.onboardingCompleted ? '/home' : '/onboarding')
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
      <img src="/assets/hero.png" alt="MorningQuestの冒険者キャラクター" />
    </section>
    <section class="auth-card">
      <p class="eyebrow">WELCOME BACK</p>
      <h2>冒険を続ける</h2>
      <form @submit.prevent="login">
        <label>
          <span>メールアドレス</span>
          <input v-model.trim="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        </label>
        <label>
          <span>パスワード</span>
          <input v-model="password" type="password" autocomplete="current-password" minlength="8" placeholder="8文字以上" required />
        </label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="button button--wide" type="submit" :disabled="submitting">
          {{ submitting ? '確認中…' : 'ログイン' }}
        </button>
      </form>
      <button class="button button--outline button--wide" type="button" @click="useDemo">
        デモモードで始める
      </button>
      <p class="auth-note">デモモードでは入力した認証情報を保存・送信しません。</p>
    </section>
  </div>
</template>
