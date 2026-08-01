import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestStore } from './quest'
import type { QuestTask } from '../domain/types'

vi.mock('@/services/apiClient', () => ({
  isBackendConfigured: false,
  apiClient: {
    updateTaskStatus: vi.fn(async (taskId: string, status: string) => ({
      id: Number(taskId),
      title: '同期タスク',
      category: 'OTHER',
      status,
      estimated_minutes: 15,
      is_completed: status === 'DONE',
      recommended_qr: null,
    })),
    savePlan: vi.fn(async (plan: unknown) => plan),
    deleteTask: vi.fn(async () => ({ status: 'deleted' })),
    getPlan: vi.fn(async () => {
      throw new Error('no server')
    }),
    getGameState: vi.fn(async () => {
      throw new Error('no server')
    }),
    battle: vi.fn(async () => {
      throw new Error('no server')
    }),
  },
}))

describe('quest store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('QR成功でTODOをSTARTEDにし、報酬候補を1件だけ作る', async () => {
    const store = useQuestStore()
    const task = store.tasks.find((item: QuestTask) => item.status === 'TODO')

    expect(task).toBeDefined()
    const firstResult = await store.startTask(task!.id)
    const secondResult = await store.startTask(task!.id)

    expect(firstResult).toBe(true)
    expect(secondResult).toBe(false)
    expect(store.tasks.find((item) => item.id === task!.id)?.status).toBe('STARTED')
    expect(store.game.inventory.filter((item) => item.sourceTaskId === task!.id)).toHaveLength(1)
  })

  it('着手済みタスクの完了でアイテムを利用可能にしコインを付与する', async () => {
    const store = useQuestStore()
    const task = store.tasks.find((item) => item.status === 'TODO')!
    const initialCoins = store.game.coins
    await store.startTask(task.id)

    await expect(store.completeTask(task.id)).resolves.toBe(true)
    await expect(store.completeTask(task.id)).resolves.toBe(false)
    expect(store.game.inventory.find((item) => item.sourceTaskId === task.id)?.state).toBe(
      'AVAILABLE',
    )
    expect(store.game.coins).toBe(initialCoins + task.weight * 20)
  })

  it('攻撃は選択アイテムを消費し、同じイベントIDを二重適用しない', async () => {
    const store = useQuestStore()
    const availableItem = store.game.inventory.find((item) => item.state === 'AVAILABLE')!
    const initialHp = store.game.enemyHp

    const first = await store.attack([availableItem.id], 'event-1')
    const second = await store.attack([availableItem.id], 'event-1')

    expect(first.damage).toBeGreaterThan(0)
    expect(second).toEqual(first)
    expect(store.game.enemyHp).toBe(initialHp - first.damage)
    expect(store.game.inventory.find((item) => item.id === availableItem.id)?.state).toBe(
      'CONSUMED',
    )
  })

  it('進捗・予測・次タスク・使用可能アイテムを返す', () => {
    const store = useQuestStore()

    expect(store.progress.totalCount).toBe(5)
    expect(store.forecast.remainingMinutes).toBeGreaterThan(0)
    expect(store.nextTask?.status).toBe('TODO')
    expect(store.availableItems).toHaveLength(1)
  })

  it('存在しないまたは着手済みタスクは開始しない', async () => {
    const store = useQuestStore()

    expect(await store.startTask('missing')).toBe(false)
    expect(await store.startTask('habit-breakfast')).toBe(false)
  })

  it('未着手や存在しないタスクは完了しない', async () => {
    const store = useQuestStore()

    await expect(store.completeTask('daily-report')).resolves.toBe(false)
    await expect(store.completeTask('missing')).resolves.toBe(false)
  })

  it('PCタスクと通常タスクを追加できる', async () => {
    const store = useQuestStore()
    const pcTask = await store.addTask('  資料を作る  ', 'PC')
    const normalTask = await store.addTask('水を飲む')

    expect(pcTask).toMatchObject({
      title: '資料を作る',
      category: 'PC_WORK',
      estimatedMinutes: 45,
      weight: 3,
    })
    expect(normalTask).toMatchObject({
      category: 'OTHER',
      estimatedMinutes: 20,
      weight: 2,
    })
  })

  it('ユーザーが指定した所要時間をそのままタスクへ保存する', async () => {
    const store = useQuestStore()

    const task = await store.addTask('読書する', 'NONE', 75)

    expect(task).toMatchObject({
      title: '読書する',
      estimatedMinutes: 75,
      weight: 4,
    })
  })

  it('日付が変わると既定の習慣タスクを重複なく翌日分へ追加する', () => {
    const store = useQuestStore()
    store.plan.localDate = '2026-07-31'
    store.plan.tasks = []

    expect(store.ensureDailyHabits('2026-08-01')).toBe(true)
    expect(store.plan).toMatchObject({ localDate: '2026-08-01' })
    expect(store.tasks.map((task) => task.title)).toEqual(['歯を磨く', '朝食を食べる'])
    expect(store.tasks.every((task) => task.status === 'TODO')).toBe(true)
    expect(store.ensureDailyHabits('2026-08-01')).toBe(false)
    expect(store.tasks).toHaveLength(2)
  })

  it('未完了タスクだけ削除できる', async () => {
    const store = useQuestStore()
    const initialCount = store.tasks.length

    await store.removeTask('daily-walk')
    await store.removeTask('habit-brush')
    await store.removeTask('missing')

    expect(store.tasks).toHaveLength(initialCount - 1)
    expect(store.tasks.some((task) => task.id === 'habit-brush')).toBe(true)
  })

  it('計画時刻を保存してversionを進める', async () => {
    const store = useQuestStore()

    await store.savePlan('06:30', '23:00')

    expect(store.plan).toMatchObject({ wakeTime: '06:30', sleepTime: '23:00', version: 2 })
    expect(store.toast).toContain('Webアラーム')
  })

  it('アイテム未選択の攻撃ではHPを減らさない', async () => {
    const store = useQuestStore()
    const initialHp = store.game.enemyHp

    await expect(store.attack([], 'empty-event')).resolves.toEqual({ damage: 0, enemyHp: initialHp })
    expect(store.game.enemyHp).toBe(initialHp)
  })

  it('状態フラグを更新してトーストを消せる', () => {
    const store = useQuestStore()

    store.setAuthenticated(false)
    store.setOnboardingCompleted(false)
    store.setOffline(true)
    store.setPhaseOverride('night')
    store.toast = 'message'
    store.clearToast()

    expect(store.isAuthenticated).toBe(false)
    expect(store.onboardingCompleted).toBe(false)
    expect(store.isOffline).toBe(true)
    expect(store.phaseOverride).toBe('night')
    expect(store.toast).toBe('')
  })

  it('保存済み状態を復元し、不正JSONは破棄する', async () => {
    const store = useQuestStore()
    await store.savePlan('06:45', '22:45')
    const saved = localStorage.getItem('morningquest-demo')

    setActivePinia(createPinia())
    const restored = useQuestStore()
    await restored.hydrate()
    expect(restored.plan.wakeTime).toBe('06:45')

    localStorage.setItem('morningquest-demo', '{broken')
    await restored.hydrate()
    expect(localStorage.getItem('morningquest-demo')).toBeNull()
    expect(saved).not.toBeNull()
  })

  it('未保存時の復元は何も変更せず、リセットで初期状態に戻す', async () => {
    const store = useQuestStore()
    await store.hydrate()
    await store.savePlan('05:30', '22:00')
    store.resetDemo()

    expect(store.plan.wakeTime).toBe('07:00')
    expect(localStorage.getItem('morningquest-demo')).toBeNull()
  })
})
