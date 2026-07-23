import { defineStore } from 'pinia'
import { calculateProgress, estimateBattleDamage, forecastDay } from '@/domain/quest'
import type { DailyPlan, GameState, InventoryItem, PlaceType, QuestTask } from '@/domain/types'

interface BattleResult {
  damage: number
  enemyHp: number
}

interface QuestState {
  userName: string
  isAuthenticated: boolean
  onboardingCompleted: boolean
  isOffline: boolean
  phaseOverride: 'night' | 'morning' | 'daytime' | null
  plan: DailyPlan
  game: GameState
  processedBattles: Record<string, BattleResult>
  toast: string
}

const demoTasks: QuestTask[] = [
  {
    id: 'habit-brush',
    title: '歯を磨く',
    taskType: 'HABIT',
    category: 'HYGIENE',
    status: 'DONE',
    estimatedMinutes: 5,
    weight: 1,
    requiredPlace: 'WASHROOM',
    scheduledWindow: 'MORNING',
  },
  {
    id: 'habit-breakfast',
    title: '朝食を食べる',
    taskType: 'HABIT',
    category: 'MEAL',
    status: 'STARTED',
    estimatedMinutes: 20,
    weight: 2,
    requiredPlace: 'NONE',
    scheduledWindow: 'MORNING',
  },
  {
    id: 'daily-report',
    title: 'レポートの構成を書く',
    taskType: 'DAILY',
    category: 'PC_WORK',
    status: 'TODO',
    estimatedMinutes: 45,
    weight: 3,
    requiredPlace: 'PC',
    scheduledWindow: 'DAYTIME',
  },
  {
    id: 'daily-walk',
    title: '20分散歩する',
    taskType: 'DAILY',
    category: 'EXERCISE',
    status: 'TODO',
    estimatedMinutes: 20,
    weight: 2,
    requiredPlace: 'ENTRANCE',
    scheduledWindow: 'DAYTIME',
  },
  {
    id: 'daily-reading',
    title: '本を15分読む',
    taskType: 'DAILY',
    category: 'OTHER',
    status: 'TODO',
    estimatedMinutes: 15,
    weight: 1,
    requiredPlace: 'NONE',
    scheduledWindow: 'EVENING',
  },
]

const demoInventory: InventoryItem[] = [
  {
    id: 'item-blade',
    type: 'BLADE',
    power: 30,
    state: 'AVAILABLE',
    sourceTaskId: 'habit-brush',
  },
  {
    id: 'item-spark',
    type: 'SPARK',
    power: 15,
    state: 'PENDING',
    sourceTaskId: 'habit-breakfast',
  },
]

function initialState(): QuestState {
  return {
    userName: 'ゆうき',
    isAuthenticated: true,
    onboardingCompleted: true,
    isOffline: false,
    phaseOverride: null,
    plan: {
      localDate: new Date().toISOString().slice(0, 10),
      wakeTime: '07:00',
      sleepTime: '23:30',
      version: 1,
      tasks: structuredClone(demoTasks),
    },
    game: {
      level: 12,
      xp: 1240,
      streakDays: 7,
      enemyName: '洞窟のゴブリン',
      enemyHp: 380,
      enemyMaxHp: 700,
      inventory: structuredClone(demoInventory),
    },
    processedBattles: {},
    toast: '',
  }
}

export const useQuestStore = defineStore('quest', {
  state: initialState,
  getters: {
    tasks: (state): QuestTask[] => state.plan.tasks,
    progress: (state) => calculateProgress(state.plan.tasks),
    forecast: (state) => forecastDay(state.plan.tasks, 180),
    availableItems: (state) => state.game.inventory.filter((item) => item.state === 'AVAILABLE'),
    nextTask: (state) =>
      state.plan.tasks.find((task) => task.status === 'TODO') ??
      state.plan.tasks.find((task) => task.status === 'STARTED') ??
      null,
  },
  actions: {
    startTask(taskId: string): boolean {
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'TODO') return false

      task.status = 'STARTED'
      if (!this.game.inventory.some((item) => item.sourceTaskId === taskId)) {
        this.game.inventory.push({
          id: `reward-${taskId}`,
          type: task.weight >= 4 ? 'BLADE' : 'SPARK',
          power: task.weight >= 4 ? 30 : 15,
          state: 'PENDING',
          sourceTaskId: taskId,
        })
      }
      this.toast = `${task.title}を開始しました`
      this.persist()
      return true
    },
    completeTask(taskId: string): boolean {
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'STARTED') return false

      task.status = 'DONE'
      const reward = this.game.inventory.find((item) => item.sourceTaskId === taskId)
      if (reward) reward.state = 'AVAILABLE'
      this.game.xp += task.weight * 20
      this.toast = `${task.title}を達成！ アイテムを獲得しました`
      this.persist()
      return true
    },
    addTask(title: string, requiredPlace: PlaceType = 'NONE'): QuestTask {
      const task: QuestTask = {
        id: crypto.randomUUID(),
        title: title.trim(),
        taskType: 'DAILY',
        category: requiredPlace === 'PC' ? 'PC_WORK' : 'OTHER',
        status: 'TODO',
        estimatedMinutes: requiredPlace === 'PC' ? 45 : 20,
        weight: requiredPlace === 'PC' ? 3 : 2,
        requiredPlace,
        scheduledWindow: 'DAYTIME',
      }
      this.plan.tasks.push(task)
      this.persist()
      return task
    },
    removeTask(taskId: string): void {
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status === 'DONE') return
      this.plan.tasks = this.plan.tasks.filter((item) => item.id !== taskId)
      this.persist()
    },
    savePlan(wakeTime: string, sleepTime: string): void {
      this.plan.wakeTime = wakeTime
      this.plan.sleepTime = sleepTime
      this.plan.version += 1
      this.toast = '明日の計画とWebアラームを保存しました'
      this.persist()
    },
    attack(itemIds: string[], clientEventId: string): BattleResult {
      const existing = this.processedBattles[clientEventId]
      if (existing) return existing

      const selected = this.game.inventory.filter(
        (item) => itemIds.includes(item.id) && item.state === 'AVAILABLE',
      )
      const damage = estimateBattleDamage(
        selected.map((item) => item.power),
        this.game.streakDays,
        this.progress.percentage,
      )
      selected.forEach((item) => {
        item.state = 'CONSUMED'
      })
      this.game.enemyHp = Math.max(0, this.game.enemyHp - damage)
      const result = { damage, enemyHp: this.game.enemyHp }
      this.processedBattles[clientEventId] = result
      this.toast = damage > 0 ? `${damage}ダメージ！` : 'アイテムを選んでください'
      this.persist()
      return result
    },
    setAuthenticated(authenticated: boolean): void {
      this.isAuthenticated = authenticated
      this.persist()
    },
    setOnboardingCompleted(completed: boolean): void {
      this.onboardingCompleted = completed
      this.persist()
    },
    setOffline(offline: boolean): void {
      this.isOffline = offline
    },
    setPhaseOverride(phase: QuestState['phaseOverride']): void {
      this.phaseOverride = phase
    },
    clearToast(): void {
      this.toast = ''
    },
    hydrate(): void {
      const raw = localStorage.getItem('morningquest-demo')
      if (!raw) return
      try {
        const saved = JSON.parse(raw) as Partial<QuestState>
        if (saved.plan && saved.game) {
          this.$patch({
            ...saved,
            plan: saved.plan,
            game: saved.game,
          })
        }
      } catch {
        localStorage.removeItem('morningquest-demo')
      }
    },
    persist(): void {
      localStorage.setItem(
        'morningquest-demo',
        JSON.stringify({
          userName: this.userName,
          isAuthenticated: this.isAuthenticated,
          onboardingCompleted: this.onboardingCompleted,
          phaseOverride: this.phaseOverride,
          plan: this.plan,
          game: this.game,
          processedBattles: this.processedBattles,
        }),
      )
    },
    resetDemo(): void {
      this.$reset()
      localStorage.removeItem('morningquest-demo')
    },
  },
})
