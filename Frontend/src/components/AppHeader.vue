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
      <span class="sync-state" :class="{ 'sync-state--offline': store.isOffline }">
        <span aria-hidden="true">{{ store.isOffline ? '●' : '●' }}</span>
        {{ store.isOffline ? 'オフライン' : '同期済み' }}
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
