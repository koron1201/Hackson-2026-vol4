import { defineStore } from 'pinia'
import { calculateProgress, estimateBattleDamage, forecastDay } from '@/domain/quest'
import {
  apiClient,
  isBackendConfigured,
  type BackendTask,
  type TaskAnalysisResponse,
} from '@/services/apiClient'
import type { DailyPlan, GameState, InventoryItem, PlaceType, QuestTask } from '@/domain/types'

interface BattleResult {
  damage: number
  enemyHp: number
}

interface QuestState {
  backendEnabled: boolean
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
  if (isBackendConfigured) {
    return {
      backendEnabled: true,
      userName: 'Hero',
      isAuthenticated: false,
      onboardingCompleted: true,
      isOffline: false,
      phaseOverride: null,
      plan: {
        localDate: new Date().toISOString().slice(0, 10),
        wakeTime: '07:00',
        sleepTime: '23:30',
        version: 1,
        tasks: [],
      },
      game: {
        level: 1,
        coins: 0,
        streakDays: 0,
        enemyName: '未接続',
        enemyHp: 0,
        enemyMaxHp: 1,
        inventory: [],
      },
      processedBattles: {},
      toast: '',
    }
  }

  return {
    backendEnabled: false,
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
      coins: 1240,
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

function persistenceKey(backendEnabled: boolean): string {
  return backendEnabled ? 'morningquest-backend' : 'morningquest-demo'
}

function placeToBackendQr(place: PlaceType): string | null {
  const qrCodes: Record<PlaceType, string | null> = {
    WASHROOM: 'WASHROOM',
    PC: 'DESK',
    ENTRANCE: 'ENTRANCE',
    NONE: null,
  }
  return qrCodes[place]
}

function backendQrToPlace(value: unknown): PlaceType {
  if (typeof value !== 'string') return 'NONE'
  const qrCode = value.trim().toUpperCase()
  if (qrCode === 'WASHROOM') return 'WASHROOM'
  if (qrCode === 'DESK' || qrCode === 'PC') return 'PC'
  if (qrCode === 'ENTRANCE') return 'ENTRANCE'
  return 'NONE'
}

function normalizeCategory(value: unknown): QuestTask['category'] {
  if (typeof value !== 'string') return 'OTHER'
  const category = value.trim().toUpperCase()
  if (category === 'HYGIENE' || category === '衛生' || category === '習慣') return 'HYGIENE'
  if (category === 'MEAL' || category === '食事') return 'MEAL'
  if (category === 'PC_WORK' || category === 'PC' || category === '仕事') return 'PC_WORK'
  if (category === 'OUTING' || category === '外出') return 'OUTING'
  if (category === 'EXERCISE' || category === '運動') return 'EXERCISE'
  return 'OTHER'
}

function weightForMinutes(minutes: number): number {
  if (minutes <= 15) return 1
  if (minutes <= 30) return 2
  if (minutes <= 60) return 3
  return 4
}

function safeAnalysis(analysis: TaskAnalysisResponse | null, selectedPlace: PlaceType) {
  const estimatedMinutes =
    typeof analysis?.estimated_minutes === 'number' &&
    Number.isInteger(analysis.estimated_minutes) &&
    analysis.estimated_minutes >= 1 &&
    analysis.estimated_minutes <= 1440
      ? analysis.estimated_minutes
      : selectedPlace === 'PC'
        ? 45
        : 20
  const suggestedPlace = backendQrToPlace(analysis?.recommended_qr)
  const requiredPlace = selectedPlace === 'NONE' ? suggestedPlace : selectedPlace

  return {
    category: normalizeCategory(analysis?.category),
    estimatedMinutes,
    requiredPlace,
  }
}

function backendTaskToQuestTask(task: BackendTask): QuestTask {
  if (
    !Number.isInteger(task.id) ||
    task.id <= 0 ||
    typeof task.title !== 'string' ||
    task.title.trim().length === 0 ||
    !Number.isInteger(task.estimated_minutes) ||
    task.estimated_minutes < 1 ||
    task.estimated_minutes > 1440
  ) {
    throw new Error('バックエンドから不正なタスクを受信しました。')
  }

  return {
    id: String(task.id),
    title: task.title.trim().slice(0, 120),
    taskType: 'DAILY',
    category: normalizeCategory(task.category),
    status: task.is_completed ? 'DONE' : 'TODO',
    estimatedMinutes: task.estimated_minutes,
    weight: weightForMinutes(task.estimated_minutes),
    requiredPlace: backendQrToPlace(task.recommended_qr),
    scheduledWindow: 'DAYTIME',
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
    async connectBackend(): Promise<boolean> {
      if (!this.backendEnabled) {
        this.setAuthenticated(true)
        return true
      }
      try {
        await apiClient.health()
        this.isAuthenticated = true
        this.toast = 'バックエンドへ接続しました'
        this.persist()
        return true
      } catch {
        this.isAuthenticated = false
        this.toast = 'バックエンドへ接続できません。起動状態と接続先を確認してください'
        return false
      }
    },
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
    async completeTask(taskId: string): Promise<boolean> {
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'STARTED') return false

      if (this.backendEnabled) {
        const backendTaskId = Number(task.id)
        if (!Number.isSafeInteger(backendTaskId) || backendTaskId <= 0) {
          this.toast = 'このタスクはバックエンドと同期できません'
          return false
        }
        try {
          const result = await apiClient.completeTask(backendTaskId)
          if (
            !Number.isSafeInteger(result.total_coins) ||
            result.total_coins < 0 ||
            !Number.isSafeInteger(result.earned_coins) ||
            result.earned_coins < 0
          ) {
            throw new Error('Invalid completion response')
          }
          task.status = 'DONE'
          this.game.coins = result.total_coins
          this.toast = `${task.title}を達成！ ${result.earned_coins}コイン獲得`
          this.persist()
          return true
        } catch {
          this.toast = '通信に失敗したため、タスクは完了にしていません'
          return false
        }
      }

      task.status = 'DONE'
      const reward = this.game.inventory.find((item) => item.sourceTaskId === taskId)
      if (reward) reward.state = 'AVAILABLE'
      this.game.coins += task.weight * 20
      this.toast = `${task.title}を達成！ アイテムを獲得しました`
      this.persist()
      return true
    },
    async addTask(title: string, requiredPlace: PlaceType = 'NONE'): Promise<QuestTask> {
      const normalizedTitle = title.trim().slice(0, 120)
      if (!normalizedTitle) throw new Error('タスク名を入力してください。')

      if (this.backendEnabled) {
        let analysis: TaskAnalysisResponse | null = null
        try {
          analysis = await apiClient.analyzeTask(normalizedTitle)
        } catch {
          // AI分析に失敗しても決定論的な既定値でタスク作成は継続する。
        }
        const normalized = safeAnalysis(analysis, requiredPlace)
        const created = await apiClient.createTask({
          user_id: 1,
          title: normalizedTitle,
          category: normalized.category,
          estimated_minutes: normalized.estimatedMinutes,
          is_completed: false,
          recommended_qr: placeToBackendQr(normalized.requiredPlace),
        })
        const task = backendTaskToQuestTask(created)
        this.plan.tasks.push(task)
        this.toast = `${task.title}をバックエンドへ登録しました`
        this.persist()
        return task
      }

      const task: QuestTask = {
        id: crypto.randomUUID(),
        title: normalizedTitle,
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
    async verifyQrForTask(rawQrCode: string, taskId: string): Promise<boolean> {
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'TODO') return false

      if (!this.backendEnabled) {
        if (!rawQrCode.startsWith('mq1_') && rawQrCode !== 'demo') return false
        return this.startTask(taskId)
      }

      const targetQrCode = placeToBackendQr(task.requiredPlace)
      if (!targetQrCode) return this.startTask(taskId)

      try {
        const result = await apiClient.verifyQr(rawQrCode, targetQrCode)
        if (result.success !== true) {
          this.toast = 'QRコードが一致しません'
          return false
        }
        return this.startTask(taskId)
      } catch {
        this.toast = 'QRコードを確認できません。通信状態を確認してください'
        return false
      }
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
      const key = persistenceKey(this.backendEnabled)
      const raw = localStorage.getItem(key)
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
        localStorage.removeItem(key)
      }
    },
    persist(): void {
      const key = persistenceKey(this.backendEnabled)
      localStorage.setItem(
        key,
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
      const key = persistenceKey(this.backendEnabled)
      this.$reset()
      localStorage.removeItem(key)
    },
  },
})
