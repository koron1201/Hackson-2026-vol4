import { defineStore } from 'pinia'
import {
  calculateProgress,
  estimateBattleDamage,
  forecastDay,
  minutesUntilClock,
} from '@/domain/quest'
import {
  apiClient,
  isBackendConfigured,
  setAccessToken,
  type BackendTask,
  type TaskAnalysisResponse,
} from '@/services/apiClient'
import type {
  DailyPlan,
  GameState,
  InventoryItem,
  PlaceType,
  QuestTask,
  TaskCategory,
  TaskStatus,
} from '@/domain/types'

interface BattleResult {
  damage: number
  enemyHp: number
}

export type QrVerificationOutcome = 'VERIFIED' | 'MISMATCH' | 'UNAVAILABLE'
export interface TaskSuggestion {
  category: TaskCategory
  estimatedMinutes: number
  requiredPlace: PlaceType
  source: 'AI' | 'RULE'
}

type SessionErrorDisposition = 'stale' | 'unauthorized' | 'handled'

interface QuestState {
  backendEnabled: boolean
  sessionRevision: number
  userName: string
  isAuthenticated: boolean
  onboardingCompleted: boolean
  isOffline: boolean
  phaseOverride: 'night' | 'morning' | 'daytime' | null
  clockTick: number
  plan: DailyPlan
  game: GameState
  processedBattles: Record<string, BattleResult>
  toast: string
}

let clockTimer: number | null = null

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

const defaultHabitTemplates: Array<
  Pick<QuestTask, 'title' | 'category' | 'estimatedMinutes' | 'weight' | 'requiredPlace' | 'scheduledWindow'>
> = [
  {
    title: '歯を磨く',
    category: 'HYGIENE',
    estimatedMinutes: 5,
    weight: 1,
    requiredPlace: 'WASHROOM',
    scheduledWindow: 'MORNING',
  },
  {
    title: '朝食を食べる',
    category: 'MEAL',
    estimatedMinutes: 20,
    weight: 2,
    requiredPlace: 'NONE',
    scheduledWindow: 'MORNING',
  },
]

function createDailyHabits(localDate: string): QuestTask[] {
  return defaultHabitTemplates.map((template, index) => ({
    ...template,
    id: `habit-${localDate}-${index + 1}`,
    taskType: 'HABIT',
    status: 'TODO',
  }))
}

function currentLocalDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function createDemoState(): Omit<QuestState, 'backendEnabled' | 'isOffline'> {
  const today = currentLocalDate()

  return {
    sessionRevision: 0,
    userName: 'ゆうき',
    isAuthenticated: true,
    onboardingCompleted: true,
    phaseOverride: null,
    clockTick: Date.now(),
    plan: {
      localDate: today,
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'TODO' || value === 'STARTED' || value === 'DONE' || value === 'SKIPPED'
}

function normalizeCategory(value: unknown): TaskCategory {
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

function weightFromValue(value: unknown, minutes: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : weightForMinutes(minutes)
}

function parseServerTask(source: unknown, fallbackId = '0'): QuestTask {
  const task = asRecord(source)
  const estimatedMinutesRaw = task.estimatedMinutes ?? task.estimated_minutes
  const estimatedMinutes =
    typeof estimatedMinutesRaw === 'number' && Number.isFinite(estimatedMinutesRaw)
      ? Math.max(1, Math.min(1440, Math.round(estimatedMinutesRaw)))
      : 15
  const status = isTaskStatus(task.status)
    ? task.status
    : task.is_completed === true
      ? 'DONE'
      : 'TODO'

  return {
    id: String(task.id ?? task.task_id ?? fallbackId),
    title: typeof task.title === 'string' ? task.title.trim().slice(0, 120) : 'Untitled',
    taskType: task.taskType === 'HABIT' ? 'HABIT' : 'DAILY',
    category: normalizeCategory(task.category ?? task.cat),
    status,
    estimatedMinutes,
    weight: weightFromValue(task.weight, estimatedMinutes),
    requiredPlace: backendQrToPlace(task.requiredPlace ?? task.recommended_qr),
    scheduledWindow:
      task.scheduledWindow === 'MORNING' ||
      task.scheduledWindow === 'DAYTIME' ||
      task.scheduledWindow === 'EVENING'
        ? task.scheduledWindow
        : 'ANY',
  }
}

function normalizePlan(source: unknown, fallback: DailyPlan): DailyPlan {
  const plan = asRecord(source)
  const tasks = Array.isArray(plan.tasks)
    ? plan.tasks.map((task, index) => parseServerTask(task, String(index)))
    : fallback.tasks
  return {
    localDate:
      typeof plan.localDate === 'string'
        ? plan.localDate
        : typeof plan.date === 'string'
          ? plan.date
          : fallback.localDate,
    wakeTime: typeof plan.wakeTime === 'string' ? plan.wakeTime : fallback.wakeTime,
    sleepTime: typeof plan.sleepTime === 'string' ? plan.sleepTime : fallback.sleepTime,
    version: typeof plan.version === 'number' ? plan.version : fallback.version,
    tasks,
  }
}

function normalizeGameState(source: unknown, fallback: GameState): GameState {
  const game = asRecord(source)
  const numberOr = (key: string, defaultValue: number) =>
    typeof game[key] === 'number' && Number.isFinite(game[key]) ? game[key] : defaultValue
  const isItemType = (value: unknown): value is InventoryItem['type'] =>
    value === 'SPARK' || value === 'BLADE' || value === 'CRYSTAL'
  const isItemState = (value: unknown): value is InventoryItem['state'] =>
    value === 'PENDING' || value === 'AVAILABLE' || value === 'CONSUMED'
  const inventory = Array.isArray(game.inventory)
    ? game.inventory.filter((item): item is InventoryItem => {
        const value = asRecord(item)
        return (
          typeof value.id === 'string' && value.id.trim().length > 0 &&
          isItemType(value.type) &&
          typeof value.power === 'number' && Number.isFinite(value.power) &&
          isItemState(value.state) &&
          typeof value.sourceTaskId === 'string' && value.sourceTaskId.trim().length > 0
        )
      })
    : fallback.inventory
  const enemyName = typeof game.enemyName === 'string' ? game.enemyName.trim() : ''

  return {
    level: numberOr('level', fallback.level),
    coins: numberOr('coins', fallback.coins),
    streakDays: numberOr('streakDays', fallback.streakDays),
    enemyName: enemyName || '紫の守護者',
    enemyHp: numberOr('enemyHp', fallback.enemyHp),
    enemyMaxHp: Math.max(1, numberOr('enemyMaxHp', fallback.enemyMaxHp)),
    inventory,
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
  return parseServerTask(task, String(task.id))
}

function createBackendState(): QuestState {
  const today = currentLocalDate()
  return {
    backendEnabled: true,
    sessionRevision: 0,
    userName: 'Hero',
    isAuthenticated: false,
    onboardingCompleted: true,
    isOffline: false,
    phaseOverride: null,
    clockTick: Date.now(),
    plan: { localDate: today, wakeTime: '07:00', sleepTime: '23:30', version: 1, tasks: [] },
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

function initialState(): QuestState {
  if (isBackendConfigured) return createBackendState()
  return { backendEnabled: false, isOffline: false, ...createDemoState() }
}

function persistenceKey(backendEnabled: boolean): string {
  return backendEnabled ? 'morningquest-backend' : 'morningquest-demo'
}

function safeAnalysis(
  analysis: TaskAnalysisResponse | null,
  selectedPlace: PlaceType,
  selectedMinutes?: number,
) {
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
  return {
    category: normalizeCategory(analysis?.category),
    estimatedMinutes: selectedMinutes ?? estimatedMinutes,
    requiredPlace: selectedPlace === 'NONE' ? suggestedPlace : selectedPlace,
  }
}

export const useQuestStore = defineStore('quest', {
  state: initialState,
  getters: {
    tasks: (state): QuestTask[] => state.plan.tasks,
    progress: (state) => calculateProgress(state.plan.tasks),
    forecast: (state) =>
      forecastDay(
        state.plan.tasks,
        minutesUntilClock(state.plan.sleepTime, new Date(state.clockTick)),
      ),
    availableItems: (state) => state.game.inventory.filter((item) => item.state === 'AVAILABLE'),
    nextTask: (state) =>
      state.plan.tasks.find((task) => task.status === 'TODO') ??
      state.plan.tasks.find((task) => task.status === 'STARTED') ??
      null,
  },
  actions: {
    setUserName(userName: string): void {
      this.userName = userName.trim() || this.userName
      this.persist()
    },
    enterDemoMode(): void {
      const nextRevision = this.sessionRevision + 1
      setAccessToken(null)
      localStorage.removeItem(persistenceKey(true))
      this.backendEnabled = false
      this.$patch(createDemoState())
      this.sessionRevision = nextRevision
      this.processedBattles = {}
      this.persist()
    },
    async connectBackend(): Promise<boolean> {
      if (!this.backendEnabled) {
        this.setAuthenticated(true)
        return true
      }
      const revision = this.sessionRevision
      try {
        await apiClient.health()
        if (!this.isCurrentBackendSession(revision)) return false
        this.toast = 'バックエンドへ接続しました'
        return true
      } catch {
        if (!this.isCurrentBackendSession(revision)) return false
        this.toast = 'バックエンドへ接続できません。起動状態と接続先を確認してください'
        return false
      }
    },
    async startTask(taskId: string): Promise<boolean> {
      const revision = this.sessionRevision
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'TODO') return false

      const previous = { status: task.status, inventory: [...this.game.inventory] }
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

      if (this.backendEnabled && typeof apiClient.updateTaskStatus === 'function') {
        try {
          const updated = await apiClient.updateTaskStatus(taskId, 'STARTED', this.plan.version, task)
          if (!this.isCurrentBackendSession(revision)) return false
          Object.assign(task, backendTaskToQuestTask(updated))
          this.plan.version += 1
          this.persist()
        } catch (reason) {
          const disposition = this.handleSessionApiError(
            reason,
            revision,
            '通信に失敗したため、タスクは開始していません',
          )
          if (disposition !== 'handled') return false
          task.status = previous.status
          this.game.inventory = previous.inventory
          this.persist()
          return false
        }
      }
      return true
    },
    async completeTask(taskId: string): Promise<boolean> {
      const revision = this.sessionRevision
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
          if (!this.isCurrentBackendSession(revision)) return false
          if (
            !Number.isSafeInteger(result.total_coins) ||
            result.total_coins < 0 ||
            !Number.isSafeInteger(result.earned_coins) ||
            result.earned_coins < 0
          ) {
            throw new Error('Invalid completion response')
          }
          task.status = 'DONE'
          const reward = this.game.inventory.find((item) => item.sourceTaskId === taskId)
          if (reward) reward.state = 'AVAILABLE'
          this.game.coins = result.total_coins
          this.toast = `${task.title}を達成！ ${result.earned_coins}コイン獲得`
          this.persist()
          return true
        } catch (reason) {
          this.handleSessionApiError(
            reason,
            revision,
            '通信に失敗したため、タスクは完了にしていません',
          )
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
    async suggestTask(title: string, selectedPlace: PlaceType = 'NONE'): Promise<TaskSuggestion> {
      const normalizedTitle = title.trim().slice(0, 120)
      if (!normalizedTitle) throw new Error('タスク名を入力してください。')
      if (!this.backendEnabled) {
        return { ...safeAnalysis(null, selectedPlace), source: 'RULE' }
      }

      const revision = this.sessionRevision
      try {
        const analysis = await apiClient.analyzeTask(normalizedTitle)
        if (!this.isCurrentBackendSession(revision)) throw this.sessionChangedError()
        return {
          ...safeAnalysis(analysis, selectedPlace),
          source: analysis.note ? 'RULE' : 'AI',
        }
      } catch (reason) {
        const disposition = this.handleSessionApiError(reason, revision, '')
        if (disposition === 'stale' || disposition === 'unauthorized') throw reason
        return { ...safeAnalysis(null, selectedPlace), source: 'RULE' }
      }
    },
    async addTask(
      title: string,
      requiredPlace: PlaceType = 'NONE',
      estimatedMinutes?: number,
      suggestedCategory?: TaskCategory,
    ): Promise<QuestTask> {
      const normalizedTitle = title.trim().slice(0, 120)
      if (!normalizedTitle) throw new Error('タスク名を入力してください。')
      if (
        estimatedMinutes !== undefined &&
        (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 240)
      ) {
        throw new Error('所要時間は5〜240分の整数で入力してください。')
      }

      if (this.backendEnabled) {
        const revision = this.sessionRevision
        let analysis: TaskAnalysisResponse | null = null
        if (!suggestedCategory) {
          try {
            analysis = await apiClient.analyzeTask(normalizedTitle)
            if (!this.isCurrentBackendSession(revision)) throw this.sessionChangedError()
          } catch (reason) {
            const disposition = this.handleSessionApiError(reason, revision, '')
            if (disposition === 'stale') throw this.sessionChangedError()
            if (disposition === 'unauthorized') throw reason
            // AIが利用できない場合も決定論的な既定値で作成を続ける。
          }
        }
        const normalized = safeAnalysis(analysis, requiredPlace, estimatedMinutes)
        if (suggestedCategory) normalized.category = suggestedCategory
        let created: BackendTask
        try {
          created = await apiClient.createTask({
            user_id: 1,
            title: normalizedTitle,
            category: normalized.category,
            estimated_minutes: normalized.estimatedMinutes,
            is_completed: false,
            recommended_qr: placeToBackendQr(normalized.requiredPlace),
          })
        } catch (reason) {
          const disposition = this.handleSessionApiError(reason, revision, '')
          if (disposition === 'stale') throw this.sessionChangedError()
          throw reason
        }
        if (!this.isCurrentBackendSession(revision)) throw this.sessionChangedError()
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
        estimatedMinutes: estimatedMinutes ?? (requiredPlace === 'PC' ? 45 : 20),
        weight: weightForMinutes(estimatedMinutes ?? (requiredPlace === 'PC' ? 45 : 20)),
        requiredPlace,
        scheduledWindow: 'DAYTIME',
      }
      this.plan.tasks.push(task)
      this.persist()
      return task
    },
    async verifyQrForTaskWithOutcome(
      rawQrCode: string,
      taskId: string,
    ): Promise<QrVerificationOutcome> {
      const revision = this.sessionRevision
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status !== 'TODO') return 'UNAVAILABLE'

      if (!this.backendEnabled) {
        if (!rawQrCode.startsWith('mq1_') && rawQrCode !== 'demo') return 'MISMATCH'
        return (await this.startTask(taskId)) ? 'VERIFIED' : 'UNAVAILABLE'
      }

      const targetQrCode = placeToBackendQr(task.requiredPlace)
      if (!targetQrCode) {
        return (await this.startTask(taskId)) ? 'VERIFIED' : 'UNAVAILABLE'
      }

      try {
        const result = await apiClient.verifyQr(rawQrCode, targetQrCode)
        if (!this.isCurrentBackendSession(revision)) return 'UNAVAILABLE'
        if (result.success !== true) {
          this.toast = 'QRコードが一致しません'
          return 'MISMATCH'
        }
        return (await this.startTask(taskId)) ? 'VERIFIED' : 'UNAVAILABLE'
      } catch (reason) {
        this.handleSessionApiError(
          reason,
          revision,
          'QRコードを確認できません。通信状態を確認してください',
        )
        return 'UNAVAILABLE'
      }
    },
    async verifyQrForTask(rawQrCode: string, taskId: string): Promise<boolean> {
      return (await this.verifyQrForTaskWithOutcome(rawQrCode, taskId)) === 'VERIFIED'
    },
    async removeTask(taskId: string): Promise<void> {
      const revision = this.sessionRevision
      const task = this.plan.tasks.find((item) => item.id === taskId)
      if (!task || task.status === 'DONE') return

      const previousTasks = [...this.plan.tasks]
      this.plan.tasks = this.plan.tasks.filter((item) => item.id !== taskId)
      this.persist()

      if (this.backendEnabled) {
        try {
          await apiClient.deleteTask(taskId)
          if (!this.isCurrentBackendSession(revision)) return
          this.plan.version += 1
          this.persist()
        } catch (reason) {
          const disposition = this.handleSessionApiError(
            reason,
            revision,
            '削除に失敗したため、タスクを戻しました',
          )
          if (disposition !== 'handled') return
          this.plan.tasks = previousTasks
          this.persist()
        }
      }
    },
    async savePlan(wakeTime: string, sleepTime: string): Promise<void> {
      const revision = this.sessionRevision
      this.plan.wakeTime = wakeTime
      this.plan.sleepTime = sleepTime

      if (this.backendEnabled) {
        try {
          const saved = await apiClient.savePlan({ ...this.plan, wakeTime, sleepTime })
          if (!this.isCurrentBackendSession(revision)) return
          this.plan = normalizePlan(saved, this.plan)
          this.toast = '明日の計画とWebアラームを保存しました'
          this.persist()
          return
        } catch (reason) {
          const disposition = this.handleSessionApiError(
            reason,
            revision,
            '保存に失敗しました。オフラインの場合はローカルに保存されます',
          )
          if (disposition !== 'handled') return
        }
      } else {
        this.plan.version += 1
        this.toast = '明日の計画とWebアラームを保存しました'
      }
      this.persist()
    },
    async attack(itemIds: string[], clientEventId: string): Promise<BattleResult> {
      const revision = this.sessionRevision
      const existing = this.processedBattles[clientEventId]
      if (existing) return existing

      if (this.backendEnabled && typeof apiClient.battle === 'function') {
        try {
          const result = await apiClient.battle(itemIds, clientEventId)
          if (!this.isCurrentBackendSession(revision)) {
            return { damage: 0, enemyHp: this.game.enemyHp }
          }
          if (!Number.isInteger(result.damage) || !Number.isInteger(result.enemyHp)) {
            throw new Error('Invalid battle response')
          }
          this.game.inventory.forEach((item) => {
            if (itemIds.includes(item.id) && item.state === 'AVAILABLE') item.state = 'CONSUMED'
          })
          this.game.enemyHp = Math.max(0, result.enemyHp)
          this.processedBattles[clientEventId] = result
          this.toast = result.damage > 0 ? `${result.damage}ダメージ！` : 'アイテムを選んでください'
          this.persist()
          return result
        } catch (reason) {
          this.handleSessionApiError(
            reason,
            revision,
            '攻撃に失敗しました。通信状態を確認してください',
          )
          return { damage: 0, enemyHp: this.game.enemyHp }
        }
      }

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
    isCurrentBackendSession(revision: number): boolean {
      return this.backendEnabled && this.sessionRevision === revision
    },
    sessionChangedError(): Error {
      return new Error('セッションが変更されたため、操作を中止しました。')
    },
    handleSessionApiError(
      reason: unknown,
      revision: number,
      message: string,
    ): SessionErrorDisposition {
      if (!this.isCurrentBackendSession(revision)) return 'stale'
      if (asRecord(reason).status === 401) {
        this.logoutBackendSession()
        this.toast = '認証の有効期限が切れました。もう一度ログインしてください'
        return 'unauthorized'
      }
      if (message) this.toast = message
      return 'handled'
    },
    setAuthenticated(authenticated: boolean): void {
      if (this.backendEnabled && !authenticated) {
        this.logoutBackendSession()
        return
      }
      this.isAuthenticated = authenticated
      this.persist()
    },
    startBackendSession(userName: string): void {
      const next = createBackendState()
      const nextRevision = this.sessionRevision + 1
      localStorage.removeItem(persistenceKey(true))
      this.$patch({
        ...next,
        sessionRevision: nextRevision,
        userName: userName.trim() || next.userName,
        isAuthenticated: true,
      })
      this.processedBattles = {}
      this.persist()
    },
    logoutBackendSession(): void {
      const nextRevision = this.sessionRevision + 1
      setAccessToken(null)
      this.$patch({
        ...createBackendState(),
        sessionRevision: nextRevision,
      })
      this.processedBattles = {}
      localStorage.removeItem(persistenceKey(true))
    },
    resetLocalData(): void {
      if (this.backendEnabled) this.logoutBackendSession()
      else this.resetDemo()
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
      this.persist()
    },
    startClock(): void {
      if (clockTimer !== null) return
      this.clockTick = Date.now()
      this.ensureDailyHabits()
      clockTimer = window.setInterval(() => {
        this.clockTick = Date.now()
        this.ensureDailyHabits()
      }, 60_000)
    },
    ensureDailyHabits(localDate = currentLocalDate()): boolean {
      // The backend does not yet expose habit templates. Avoid creating unsynced local tasks in API mode.
      if (this.backendEnabled || this.plan.localDate === localDate) return false
      this.plan = {
        ...this.plan,
        localDate,
        version: this.plan.version + 1,
        tasks: createDailyHabits(localDate),
      }
      this.processedBattles = {}
      this.persist()
      return true
    },
    clearToast(): void {
      this.toast = ''
    },
    async hydrate(): Promise<void> {
      if (this.backendEnabled) {
        localStorage.removeItem(persistenceKey(true))
        if (!this.isAuthenticated) return

        const revision = this.sessionRevision
        try {
          const [plan, game] = await Promise.all([
            apiClient.getPlan(this.plan.localDate),
            apiClient.getGameState(),
          ])
          if (
            revision !== this.sessionRevision ||
            !this.backendEnabled ||
            !this.isAuthenticated
          ) {
            return
          }
          this.plan = normalizePlan(plan, this.plan)
          this.game = normalizeGameState(game, this.game)
          this.persist()
        } catch (reason) {
          if (
            revision !== this.sessionRevision ||
            !this.backendEnabled ||
            !this.isAuthenticated
          ) {
            return
          }
          const status = asRecord(reason).status
          if (status === 401) {
            this.logoutBackendSession()
            this.toast = '認証の有効期限が切れました。もう一度ログインしてください'
          } else if (status === 403) {
            this.toast = 'このデータを表示する権限がありません'
          } else {
            this.toast = 'データを同期できません。通信状態を確認してください'
          }
        }
        return
      }

      const key = persistenceKey(this.backendEnabled)
      const raw = localStorage.getItem(key)
      let saved: Partial<QuestState> | null = null
      if (raw) {
        try {
          saved = JSON.parse(raw) as Partial<QuestState>
        } catch {
          localStorage.removeItem(key)
        }
      }

      if (saved) {
        this.$patch({
          userName: saved.userName ?? this.userName,
          isAuthenticated: saved.isAuthenticated ?? this.isAuthenticated,
          onboardingCompleted: saved.onboardingCompleted ?? this.onboardingCompleted,
          phaseOverride: saved.phaseOverride ?? this.phaseOverride,
          clockTick: saved.clockTick ?? this.clockTick,
          processedBattles: saved.processedBattles ?? this.processedBattles,
        })
        if (saved.plan && saved.game) {
          this.plan = normalizePlan(saved.plan, this.plan)
          this.game = normalizeGameState(saved.game, this.game)
        }
      }
      this.ensureDailyHabits()
    },
    persist(): void {
      const key = persistenceKey(this.backendEnabled)
      if (this.backendEnabled) {
        localStorage.removeItem(key)
        return
      }
      const snapshot: Partial<QuestState> = {
        userName: this.userName,
        onboardingCompleted: this.onboardingCompleted,
        phaseOverride: this.phaseOverride,
        clockTick: this.clockTick,
        plan: this.plan,
        game: this.game,
        processedBattles: this.processedBattles,
      }
      if (!this.backendEnabled) snapshot.isAuthenticated = this.isAuthenticated
      localStorage.setItem(
        key,
        JSON.stringify(snapshot),
      )
    },
    resetDemo(): void {
      if (this.backendEnabled) {
        this.logoutBackendSession()
        return
      }
      const key = persistenceKey(false)
      const nextRevision = this.sessionRevision + 1
      const init = { backendEnabled: false, isOffline: false, ...createDemoState() }
      this.$patch({
        backendEnabled: init.backendEnabled,
        sessionRevision: nextRevision,
        userName: init.userName,
        isAuthenticated: init.isAuthenticated,
        onboardingCompleted: init.onboardingCompleted,
        isOffline: init.isOffline,
        phaseOverride: init.phaseOverride,
        clockTick: init.clockTick,
        plan: init.plan,
        game: init.game,
        processedBattles: {},
        toast: '',
      })
      this.processedBattles = {}
      localStorage.removeItem(key)
    },
  },
})
