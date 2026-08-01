<script setup lang="ts">
import { computed } from 'vue'
import { useQuestStore } from '@/stores/quest'

const store = useQuestStore()

const levelValue = computed(() => Math.max(0, Math.trunc(store.game.level)))
const coinValue = computed(() => Math.max(0, Math.trunc(store.game.coins)))
const formattedCoins = computed(() => coinValue.value.toLocaleString('ja-JP'))
const levelText = computed(() => (levelValue.value > 99 ? 'Lv.99+' : `Lv.${levelValue.value}`))
const coinText = computed(() =>
  coinValue.value >= 10_000 ? `${Math.floor(coinValue.value / 10_000)}万+` : formattedCoins.value,
)
</script>

<template>
  <header class="app-header">
    <RouterLink class="app-header__profile" to="/home" aria-label="ホームを開く">
      <img :src="'/assets/hero.png'" alt="" />
    </RouterLink>

    <div class="app-header__game">
      <span class="app-header__level">
        <span class="app-header__visible-value" aria-hidden="true">{{ levelText }}</span>
        <span class="app-header__sr-only">レベル {{ levelValue }}</span>
      </span>
      <span class="app-header__coins">
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M15 9.5c-.6-.7-1.6-1.1-3-1.1-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2c1.6.3 2.7.8 2.7 2 0 1.3-1.1 2.1-2.7 2.1-1.4 0-2.5-.5-3.1-1.2" />
        </svg>
        <span class="app-header__visible-value" aria-hidden="true">{{ coinText }}</span>
        <span class="app-header__sr-only">コイン {{ formattedCoins }}</span>
      </span>
    </div>

    <RouterLink class="app-header__notification" to="/settings" aria-label="通知設定を開く">
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" />
      </svg>
    </RouterLink>
  </header>
</template>
