<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

const route = useRoute()
const store = useQuestStore()
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/home" aria-label="MorningQuest ホーム">
      <span class="brand__sun" aria-hidden="true">☀</span>
      <span>Morning<span>Quest</span></span>
    </RouterLink>
    <div class="app-header__actions">
      <RouterLink class="header-player" to="/settings" aria-label="プロフィールと設定">
        <span class="header-player__avatar" aria-hidden="true">✦</span>
        <span>
          <strong>Lv.{{ store.game.level }}</strong>
          <small>{{ store.game.coins.toLocaleString() }} コイン</small>
        </span>
      </RouterLink>
      <span class="sync-state" :class="{ 'sync-state--offline': store.isOffline }">
        <span aria-hidden="true">{{ store.isOffline ? '●' : '●' }}</span>
        {{ store.isOffline ? 'オフライン' : store.backendEnabled ? 'API接続' : 'ローカル' }}
      </span>
      <RouterLink
        v-if="route.path !== '/settings'"
        class="icon-button"
        to="/settings"
        aria-label="設定を開く"
      >
        ⚙
      </RouterLink>
    </div>
  </header>
</template>
