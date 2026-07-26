<script setup lang="ts">
import { computed, ref } from 'vue'
import { estimateBattleDamage } from '@/domain/quest'
import { useQuestStore } from '@/stores/quest'
import type { InventoryItem } from '../domain/types'

const store = useQuestStore()
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
const enemyPercentage = computed(() => (store.game.enemyHp / store.game.enemyMaxHp) * 100)

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
        <small>XP {{ store.game.xp.toLocaleString() }}</small>
      </div>
    </section>

    <section class="battle-arena" :class="{ 'battle-arena--hit': attacking }">
      <div class="cave-stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="enemy-name">
        <span>BOSS</span>
        <strong>{{ store.game.enemyName }}</strong>
      </div>
      <div class="goblin" aria-label="洞窟のゴブリン">🧌</div>
      <Transition name="damage-pop">
        <div v-if="lastDamage !== null && attacking" class="damage-number">-{{ lastDamage }}</div>
      </Transition>
      <div class="enemy-hp">
        <div class="hp-bar hp-bar--large"><span :style="{ width: `${enemyPercentage}%` }"></span></div>
        <strong>HP {{ store.game.enemyHp }} / {{ store.game.enemyMaxHp }}</strong>
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
              {{ item.type === 'SPARK' ? '✦' : item.type === 'BLADE' ? '⚔' : '◆' }}
            </span>
            <strong>{{ item.type }}</strong>
            <small>威力 {{ item.power }}</small>
            <em>{{ item.state === 'PENDING' ? 'タスク完了で解放' : item.state === 'CONSUMED' ? '使用済み' : '選択可能' }}</em>
          </label>
        </div>
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
            <div><dt>連続{{ store.game.streakDays }}日</dt><dd>×1.25</dd></div>
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
