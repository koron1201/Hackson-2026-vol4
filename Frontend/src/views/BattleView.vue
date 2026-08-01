<script setup lang="ts">
import { computed, ref } from 'vue'
import { estimateBattleDamage, streakMultiplier } from '@/domain/quest'
import { useQuestStore } from '@/stores/quest'
import type { InventoryItem } from '../domain/types'

const store = useQuestStore()
const itemAssetByType: Record<InventoryItem['type'], string> = {
  SPARK: '/assets/item-spark.png',
  BLADE: '/assets/item-blade.png',
  CRYSTAL: '/assets/item-crystal.png',
}
const enemyDisplayName = computed(() => store.game.enemyName.trim() || '紫の守護者')
const selectedIds = ref<string[]>(store.availableItems.map((item: InventoryItem) => item.id))
const lastDamage = ref<number | null>(null)
const attacking = ref(false)

const selectedItems = computed(() =>
  store.availableItems.filter((item: InventoryItem) => selectedIds.value.includes(item.id)),
)
const estimatedDamage = computed(() =>
  estimateBattleDamage(
    selectedItems.value.map((item: InventoryItem) => item.power),
    store.game.streakDays,
    store.progress.percentage,
  ),
)
const enemyMaxHp = computed(() => Math.max(1, store.game.enemyMaxHp))
const enemyCurrentHp = computed(() => Math.min(enemyMaxHp.value, Math.max(0, store.game.enemyHp)))
const enemyPercentage = computed(() => Math.min(100, Math.max(0, (enemyCurrentHp.value / enemyMaxHp.value) * 100)))
const enemyState = computed(() => {
  if (enemyCurrentHp.value === 0) return 'defeated'
  if (enemyPercentage.value <= 25) return 'critical'
  if (enemyPercentage.value <= 50) return 'wounded'
  return 'healthy'
})
const enemyStatusLabel = computed(() => {
  if (enemyState.value === 'defeated') return '撃破'
  if (enemyState.value === 'critical') return 'あと一息'
  if (enemyState.value === 'wounded') return '弱っている'
  return '警戒中'
})
const formattedStreakMultiplier = computed(() => `×${streakMultiplier(store.game.streakDays).toFixed(2)}`)

function itemAsset(itemType: InventoryItem['type']): string {
  return itemAssetByType[itemType] ?? itemAssetByType.CRYSTAL
}

async function attack() {
  if (selectedIds.value.length === 0 || attacking.value) return
  attacking.value = true
  const result = await store.attack([...selectedIds.value], crypto.randomUUID())
  lastDamage.value = result.damage
  selectedIds.value = []
  window.setTimeout(() => {
    attacking.value = false
  }, 700)
}
</script>

<template>
  <div class="page battle-page">
    <section class="battle-header">
      <div>
        <p class="eyebrow">NIGHT BATTLE</p>
        <h1>今日の成果を力に変えよう</h1>
      </div>
      <div class="player-level">
        <span>Lv.</span>
        <strong>{{ store.game.level }}</strong>
        <small>連続{{ store.game.streakDays }}日 · {{ formattedStreakMultiplier }}</small>
      </div>
    </section>

    <section
      class="battle-arena"
      :class="{ 'battle-arena--hit': attacking }"
      :data-enemy-state="enemyState"
      aria-labelledby="battle-enemy-name"
    >
      <div class="cave-stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="enemy-name">
        <span>PURPLE BOSS</span>
        <strong id="battle-enemy-name">{{ enemyDisplayName }}</strong>
      </div>
      <div class="battle-enemy" aria-hidden="true">
        <img :src="'/assets/enemy-purple-ogre.png'" alt="" />
      </div>
      <Transition name="damage-pop">
        <div
          v-if="lastDamage !== null && attacking"
          class="damage-number"
          role="status"
          :aria-label="`${lastDamage}ダメージ`"
        >
          -{{ lastDamage }}
        </div>
      </Transition>
      <div class="enemy-hp">
        <div class="enemy-hp__meta">
          <strong>{{ enemyStatusLabel }}</strong>
          <span>HP {{ enemyCurrentHp }} / {{ enemyMaxHp }}</span>
        </div>
        <div
          class="hp-bar hp-bar--large"
          role="progressbar"
          :aria-label="`${enemyDisplayName}HP`"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(enemyPercentage)"
          :aria-valuetext="`${enemyCurrentHp} / ${enemyMaxHp}`"
        >
          <span :style="{ width: `${enemyPercentage}%` }"></span>
        </div>
      </div>
    </section>

    <div class="battle-grid">
      <section class="card inventory-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">INVENTORY</p>
            <h2>使うアイテム</h2>
          </div>
          <span>{{ store.availableItems.length }}個 使用可能</span>
        </div>
        <div v-if="store.game.inventory.length" class="item-grid">
          <label
            v-for="item in store.game.inventory"
            :key="item.id"
            class="battle-item"
            :class="{ selected: selectedIds.includes(item.id), disabled: item.state !== 'AVAILABLE' }"
          >
            <input
              v-model="selectedIds"
              type="checkbox"
              :value="item.id"
              :disabled="item.state !== 'AVAILABLE'"
            />
            <span class="item-icon" :data-type="item.type" aria-hidden="true">
              <img :src="itemAsset(item.type)" alt="" />
            </span>
            <strong>{{ item.type }}</strong>
            <small>威力 {{ item.power }}</small>
            <em>{{ item.state === 'PENDING' ? 'タスク完了で解放' : item.state === 'CONSUMED' ? '使用済み' : '選択可能' }}</em>
          </label>
        </div>
        <p v-else class="empty-state">使用可能なアイテムはありません。タスクを完了すると獲得できます。</p>
      </section>

      <aside class="attack-panel">
        <div class="card">
          <p class="eyebrow">ATTACK POWER</p>
          <div class="damage-preview">
            <span>予想ダメージ</span>
            <strong>{{ estimatedDamage }}</strong>
          </div>
          <dl>
            <div><dt>基礎威力</dt><dd>{{ selectedItems.reduce((sum: number, item: InventoryItem) => sum + item.power, 0) }}</dd></div>
            <div><dt>連続{{ store.game.streakDays }}日</dt><dd>{{ formattedStreakMultiplier }}</dd></div>
            <div><dt>今日の達成</dt><dd>{{ store.progress.percentage }}%</dd></div>
          </dl>
          <button class="button button--attack button--wide" type="button" :disabled="selectedIds.length === 0 || attacking" @click="attack">
            <span aria-hidden="true">⚔</span> 攻撃する！
          </button>
        </div>
        <RouterLink class="next-plan-link" to="/plan">攻撃のあとは明日の計画へ →</RouterLink>
      </aside>
    </div>
  </div>
</template>
