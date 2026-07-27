import { defineStore } from 'pinia'
import { calculateProgress, estimateBattleDamage, forecastDay, minutesUntilClock } from '@/domain/quest'
import { apiClient } from '@/services/apiClient'
import type { DailyPlan, GameState, InventoryItem, PlaceType, QuestTask, TaskCategory } from '../domain/types'

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

const allowedCategories = ['HYGIENE', 'MEAL', 'PC_WORK', 'OUTING', 'EXERCISE', 'OTHER'] as const

function parseServerTask(src: any, fallbackId = '0'): QuestTask {
  const categoryRaw = src.category ?? src.cat ?? ''
  // Accept allowed english tokens, otherwise fallback to OTHER
  const category = (allowedCategories.includes(categoryRaw) ? (categoryRaw as TaskCategory) : 'OTHER') as TaskCategory

  const estimatedMinutes = src.estimatedMinutes ?? src.estimated_minutes ?? 0
  const requiredPlace = (src.requiredPlace ?? src.recommended_qr ?? 'NONE') as PlaceType

  return {
    id: String(src.id ?? src.task_id ?? fallbackId),
    title: src.title ?? src.name ?? 'Untitled',
    taskType: (src.taskType as QuestTask['taskType']) ?? 'DAILY',
    category,
    status: (src.status as QuestTask['status']) ?? 'TODO',
    estimatedMinutes: Number(estimatedMinutes) || 0,
    weight: src.weight ?? Math.max(1, Math.floor((Number(estimatedMinutes) || 20) / 20)),
    requiredPlace: requiredPlace,
    scheduledWindow: (src.scheduledWindow as QuestTask['scheduledWindow']) ?? 'ANY',
  }
}

function normalizePlan(src: any) {
  return {
    localDate: src.localDate ?? src.date ?? new Date().toISOString().slice(0, 10),
    wakeTime: src.wakeTime ?? src.wake_time ?? '07:00',
    sleepTime: src.sleepTime ?? src.sleep_time ?? '23:30',
    version: src.version ?? 1,
    tasks: Array.isArray(src.tasks) ? src.tasks.map((t: any, i: number) => parseServerTask(t, String(i))) : [],
  } as DailyPlan
}

function initialState(): QuestState {
  return {
    userName: 'ゆうき',
    isAuthenticated: true,
    onboardingCompleted: true,
    isOffline: false,
    phaseOverride: null,
    clockTick: Date.now(),
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
    forecast: (state) => forecastDay(state.plan.tasks, minutesUntilClock(state.plan.sleepTime, new Date(state.clockTick))),
    availableItems: (state) => state.game.inventory.filter((item: InventoryItem) => item.state === 'AVAILABLE'),
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
    async startTask(taskId: string): Promise<boolean> {
      const task = this.plan.tasks.find((item: QuestTask) => item.id === taskId)
      if (!task || task.status !== 'TODO') return false

      const prevStatus = task.status
      const hadReward = this.game.inventory.some((item: InventoryItem) => item.sourceTaskId === taskId)

      // optimistic update
      task.status = 'STARTED'
      if (!hadReward) {
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

      try {
        const serverTask = await apiClient.updateTaskStatus(taskId, 'STARTED', this.plan.version, task)
        Object.assign(task, parseServerTask(serverTask, taskId))
        this.plan.version += 1
        return true
      } catch (err) {
        console.error('startTask failed', err)
        // rollback
        task.status = prevStatus
        if (!hadReward) {
          this.game.inventory = this.game.inventory.filter((i) => i.sourceTaskId !== taskId)
        }
        this.toast = err instanceof Error ? `サーバー同期に失敗しました: ${err.message}` : 'サーバー同期に失敗しました。オフライン時は後で再試行してください'
        return false
      }
    },
    async completeTask(taskId: string): Promise<boolean> {
      const task = this.plan.tasks.find((item: QuestTask) => item.id === taskId)
      if (!task || task.status !== 'STARTED') return false

      const prevStatus = task.status

      // optimistic
      task.status = 'DONE'
      const reward = this.game.inventory.find((item: InventoryItem) => item.sourceTaskId === taskId)
      if (reward) reward.state = 'AVAILABLE'
      this.game.xp += task.weight * 20
      this.toast = `${task.title}を達成！ アイテムを獲得しました`
      this.persist()

      try {
        const serverTask = await apiClient.updateTaskStatus(taskId, 'DONE', this.plan.version, task)
        Object.assign(task, parseServerTask(serverTask, taskId))
        this.plan.version += 1
        return true
      } catch (err) {
        console.error('completeTask failed', err)
        // rollback
        task.status = prevStatus
        if (reward) reward.state = 'PENDING'
        this.game.xp = Math.max(0, this.game.xp - task.weight * 20)
        this.toast = err instanceof Error ? `サーバー同期に失敗しました: ${err.message}` : 'サーバー同期に失敗しました。オフライン時は後で再試行してください'
        return false
      }
    },
    async addTask(title: string, requiredPlace: PlaceType = 'NONE'): Promise<QuestTask> {
      const payload: {
        title: string
        category: TaskCategory
        estimated_minutes: number
        is_completed: boolean
        recommended_qr: PlaceType | null
      } = {
        title: title.trim(),
        category: (requiredPlace === 'PC' ? 'PC_WORK' : 'OTHER') as TaskCategory,
        estimated_minutes: requiredPlace === 'PC' ? 45 : 20,
        is_completed: false,
        recommended_qr: requiredPlace === 'NONE' ? null : requiredPlace,
      }
      // optimistic local task until server responds
      const tempId = crypto.randomUUID()
      const tempTask: QuestTask = {
        id: tempId,
        title: payload.title,
        taskType: 'DAILY',
        category: payload.category,
        status: 'TODO',
        estimatedMinutes: payload.estimated_minutes,
        weight: payload.estimated_minutes >= 45 ? 3 : 2,
        requiredPlace: requiredPlace,
        scheduledWindow: 'DAYTIME',
      }
      this.plan.tasks.push(tempTask)
      this.persist()

      try {
        const created = await apiClient.createTask({
          title: tempTask.title,
          category: tempTask.category,
          estimated_minutes: tempTask.estimatedMinutes,
          recommended_qr: tempTask.requiredPlace === 'NONE' ? null : tempTask.requiredPlace,
        } as any)

        // map server response to local shape if necessary
        const allowedCategories = ['HYGIENE', 'MEAL', 'PC_WORK', 'OUTING', 'EXERCISE', 'OTHER'] as const
        const serverCategory = allowedCategories.includes((created as any).category) ? ((created as any).category as TaskCategory) : tempTask.category

        const serverTask: QuestTask = {
          id: String((created as any).id ?? created.id),
          title: created.title,
          taskType: (created.taskType as QuestTask['taskType']) ?? 'DAILY',
          category: serverCategory,
          status: (created.status as QuestTask['status']) ?? 'TODO',
          estimatedMinutes: (created as any).estimatedMinutes ?? (created as any).estimated_minutes ?? tempTask.estimatedMinutes,
          weight: created.weight ?? tempTask.weight,
          requiredPlace: (created as any).requiredPlace ?? (created as any).recommended_qr ?? tempTask.requiredPlace,
          scheduledWindow: (created.scheduledWindow as QuestTask['scheduledWindow']) ?? tempTask.scheduledWindow,
        }

        // replace temp task
        this.plan.tasks = this.plan.tasks.map((t) => (t.id === tempId ? serverTask : t))
        this.plan.version += 1
        this.persist()
        return serverTask
      } catch (err) {
        console.error('addTask failed', err)
        this.toast = 'タスク追加はローカルに保存されました（同期失敗）'
        return tempTask
      }
    },
    async removeTask(taskId: string): Promise<void> {
      const task = this.plan.tasks.find((item: QuestTask) => item.id === taskId)
      if (!task) return

      // optimistic remove
      const prevTasks = [...this.plan.tasks]
      this.plan.tasks = this.plan.tasks.filter((item: QuestTask) => item.id !== taskId)
      this.persist()

      try {
        await apiClient.deleteTask(taskId)
          this.plan.version += 1
          // ensure local persistence after successful delete
          this.persist()
      } catch (err) {
        console.error('removeTask failed', err)
        this.toast = 'タスク削除はローカルに保存されました（同期失敗）'
        // rollback
        this.plan.tasks = prevTasks
          this.persist()
      }
    },
    async savePlan(wakeTime: string, sleepTime: string): Promise<void> {
      this.plan.wakeTime = wakeTime
      this.plan.sleepTime = sleepTime
      // try to save to server
      try {
        const saved = await apiClient.savePlan({ ...this.plan, wakeTime, sleepTime })
        this.$patch({ plan: normalizePlan(saved) })
        this.toast = '明日の計画とWebアラームを保存しました'
        // persist local copy even when server save succeeds
        this.persist()
      } catch {
        console.error('savePlan failed')
        this.plan.version += 1
        this.toast = '保存に失敗しました。オフラインの場合はローカルに保存されます'
        this.persist()
      }
    },
    async attack(itemIds: string[], clientEventId: string): Promise<BattleResult> {
      const existing = this.processedBattles[clientEventId]
      if (existing) return existing

      try {
        const res = await apiClient.battle(itemIds, clientEventId)
        // mark consumed locally
        this.game.inventory.forEach((item: InventoryItem) => {
          if (itemIds.includes(item.id) && item.state === 'AVAILABLE') item.state = 'CONSUMED'
        })
        this.game.enemyHp = res.enemyHp
        const result = { damage: res.damage, enemyHp: res.enemyHp }
        this.processedBattles[clientEventId] = result
        this.toast = res.damage > 0 ? `${res.damage}ダメージ！` : 'アイテムを選んでください'
        this.persist()
        return result
      } catch {
        // fallback to local calculation when offline
        const selected = this.game.inventory.filter(
          (item: InventoryItem) => itemIds.includes(item.id) && item.state === 'AVAILABLE',
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
      }
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
      this.persist()
    },
    startClock(): void {
      if (clockTimer !== null) return
      clockTimer = window.setInterval(() => {
        this.clockTick = Date.now()
      }, 60_000)
    },
    clearToast(): void {
      this.toast = ''
    },
    async hydrate(): Promise<void> {
      let saved: Partial<QuestState> | null = null
      const raw = localStorage.getItem('morningquest-demo')
      if (raw) {
        try {
          saved = JSON.parse(raw) as Partial<QuestState>
        } catch {
          localStorage.removeItem('morningquest-demo')
        }
      }

      // try to load from server first
      try {
        const plan = await apiClient.getPlan(this.plan.localDate)
        const game = await apiClient.getGameState()
        this.$patch({ plan: normalizePlan(plan), game })
      } catch {
        // fallback to localStorage
      }

      if (saved) {
        this.$patch({
          userName: saved.userName ?? this.userName,
          isAuthenticated: saved.isAuthenticated ?? this.isAuthenticated,
          onboardingCompleted: saved.onboardingCompleted ?? this.onboardingCompleted,
          phaseOverride: saved.phaseOverride ?? this.phaseOverride,
          processedBattles: saved.processedBattles ?? this.processedBattles,
        })
        if (!saved.plan || !saved.game) {
          return
        }
        this.$patch({
          plan: saved.plan,
          game: saved.game,
        })
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
          clockTick: this.clockTick,
          plan: this.plan,
          game: this.game,
          processedBattles: this.processedBattles,
        }),
      )
    },
    resetDemo(): void {
      const init = initialState()
      // Explicitly replace core slices to avoid leftover/demo placeholders
      this.$patch({
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
      localStorage.removeItem('morningquest-demo')
    },
  },
})
