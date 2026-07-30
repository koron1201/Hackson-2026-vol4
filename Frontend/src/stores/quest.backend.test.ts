import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const apiMocks = vi.hoisted(() => ({
  health: vi.fn(),
  createTask: vi.fn(),
  completeTask: vi.fn(),
  verifyQr: vi.fn(),
  analyzeTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  savePlan: vi.fn(),
  deleteTask: vi.fn(),
  getPlan: vi.fn(),
  getGameState: vi.fn(),
  battle: vi.fn(),
}))

vi.mock('@/services/apiClient', () => ({
  apiClient: apiMocks,
  isBackendConfigured: true,
}))

import { useQuestStore } from './quest'

describe('quest store in backend mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    apiMocks.updateTaskStatus.mockImplementation(async (taskId: string, status: string) => ({
      id: Number(taskId),
      title: '同期タスク',
      category: 'OTHER',
      status,
      estimated_minutes: 15,
      is_completed: status === 'DONE',
      recommended_qr: null,
    }))
    apiMocks.savePlan.mockImplementation(async (plan: unknown) => plan)
    apiMocks.deleteTask.mockResolvedValue({ status: 'deleted' })
    apiMocks.getPlan.mockRejectedValue(new Error('no server'))
    apiMocks.getGameState.mockRejectedValue(new Error('no server'))
    apiMocks.battle.mockRejectedValue(new Error('no server'))
  })

  it('固定デモタスクを初期表示しない', () => {
    const store = useQuestStore()

    expect(store.backendEnabled).toBe(true)
    expect(store.tasks).toEqual([])
    expect(store.game.coins).toBe(0)
  })

  it('接続確認に成功した場合だけ利用開始する', async () => {
    apiMocks.health.mockResolvedValue({ message: 'MorningQuest API is running!' })
    const store = useQuestStore()

    await expect(store.connectBackend()).resolves.toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(apiMocks.health).toHaveBeenCalledOnce()
  })

  it('接続確認に失敗した場合は未認証のままにする', async () => {
    apiMocks.health.mockRejectedValue(new Error('network error'))
    const store = useQuestStore()

    await expect(store.connectBackend()).resolves.toBe(false)
    expect(store.isAuthenticated).toBe(false)
    expect(store.toast).toContain('接続できません')
  })

  it('ゲスト開始でバックエンド接続を使わないローカルデモへ切り替える', () => {
    const store = useQuestStore()

    store.enterDemoMode()

    expect(store.backendEnabled).toBe(false)
    expect(store.isAuthenticated).toBe(true)
    expect(store.tasks.length).toBeGreaterThan(0)
    expect(store.game.enemyName).toBe('洞窟のゴブリン')
  })

  it('AI分析結果を使ってタスクを作成しバックエンドIDを保持する', async () => {
    apiMocks.analyzeTask.mockResolvedValue({
      category: 'PC_WORK',
      estimated_minutes: 45,
      recommended_qr: 'DESK',
    })
    apiMocks.createTask.mockResolvedValue({
      id: 12,
      user_id: 1,
      title: '資料を作る',
      category: 'PC_WORK',
      estimated_minutes: 45,
      is_completed: false,
      recommended_qr: 'DESK',
    })
    const store = useQuestStore()

    const task = await store.addTask('  資料を作る  ', 'NONE')

    expect(apiMocks.analyzeTask).toHaveBeenCalledWith('資料を作る')
    expect(apiMocks.createTask).toHaveBeenCalledWith({
      user_id: 1,
      title: '資料を作る',
      category: 'PC_WORK',
      estimated_minutes: 45,
      is_completed: false,
      recommended_qr: 'DESK',
    })
    expect(task).toMatchObject({
      id: '12',
      title: '資料を作る',
      requiredPlace: 'PC',
      estimatedMinutes: 45,
    })
    expect(store.tasks).toHaveLength(1)
  })

  it('明示したQR場所はAI提案より優先する', async () => {
    apiMocks.analyzeTask.mockResolvedValue({
      category: 'OTHER',
      estimated_minutes: 10,
      recommended_qr: 'DESK',
    })
    apiMocks.createTask.mockImplementation(async (input) => ({
      id: 13,
      ...input,
    }))
    const store = useQuestStore()

    const task = await store.addTask('散歩する', 'ENTRANCE')

    expect(apiMocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ recommended_qr: 'ENTRANCE' }),
    )
    expect(task.requiredPlace).toBe('ENTRANCE')
  })

  it('AI分析に失敗しても決定論的な既定値でタスクを作成する', async () => {
    apiMocks.analyzeTask.mockRejectedValue(new Error('AI unavailable'))
    apiMocks.createTask.mockImplementation(async (input) => ({
      id: 14,
      ...input,
    }))
    const store = useQuestStore()

    const task = await store.addTask('資料を作る', 'PC')

    expect(apiMocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'OTHER',
        estimated_minutes: 45,
        recommended_qr: 'DESK',
      }),
    )
    expect(task.estimatedMinutes).toBe(45)
  })

  it('バックエンド完了後に状態とコインを更新する', async () => {
    apiMocks.completeTask.mockResolvedValue({
      message: 'Task completed!',
      earned_coins: 10,
      total_coins: 30,
    })
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'STARTED',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.completeTask('12')).resolves.toBe(true)
    expect(apiMocks.completeTask).toHaveBeenCalledWith(12)
    expect(store.tasks[0]?.status).toBe('DONE')
    expect(store.game.coins).toBe(30)
  })

  it('QR一致時だけタスクを開始し、生の値を保存しない', async () => {
    apiMocks.verifyQr.mockResolvedValue({ success: true, message: 'QRコード一致！' })
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.verifyQrForTask('DESK', '12')).resolves.toBe(true)
    expect(apiMocks.verifyQr).toHaveBeenCalledWith('DESK', 'DESK')
    expect(store.tasks[0]?.status).toBe('STARTED')
    expect(localStorage.getItem('morningquest-backend')).not.toContain('DESK')
  })

  it('QR不一致時はタスクを開始しない', async () => {
    apiMocks.verifyQr.mockResolvedValue({ success: false, message: 'QRコードが一致しません。' })
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.verifyQrForTask('WASHROOM', '12')).resolves.toBe(false)
    expect(store.tasks[0]?.status).toBe('TODO')
    expect(store.toast).toContain('一致しません')
  })

  it('通信失敗時はタスク状態を完了にしない', async () => {
    apiMocks.completeTask.mockRejectedValue(new Error('network error'))
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'STARTED',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.completeTask('12')).resolves.toBe(false)
    expect(store.tasks[0]?.status).toBe('STARTED')
    expect(store.toast).toContain('通信')
  })

  it('タスク開始をバックエンドへ同期してバージョンを進める', async () => {
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.startTask('12')).resolves.toBe(true)
    expect(apiMocks.updateTaskStatus).toHaveBeenCalledWith('12', 'STARTED', 1, expect.anything())
    expect(store.tasks[0]?.status).toBe('STARTED')
    expect(store.plan.version).toBe(2)
  })

  it('タスク開始の同期に失敗したらロールバックする', async () => {
    apiMocks.updateTaskStatus.mockRejectedValue(new Error('network error'))
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.startTask('12')).resolves.toBe(false)
    expect(store.tasks[0]?.status).toBe('TODO')
    expect(store.game.inventory).toHaveLength(0)
  })

  it('バックエンドタスクIDが不正なら完了APIを呼ばない', async () => {
    const store = useQuestStore()
    store.plan.tasks.push({
      id: 'local-id',
      title: 'ローカルタスク',
      taskType: 'DAILY',
      category: 'OTHER',
      status: 'STARTED',
      estimatedMinutes: 15,
      weight: 1,
      requiredPlace: 'NONE',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.completeTask('local-id')).resolves.toBe(false)
    expect(apiMocks.completeTask).not.toHaveBeenCalled()
  })

  it('不正な完了レスポンスは状態へ反映しない', async () => {
    apiMocks.completeTask.mockResolvedValue({ earned_coins: -1, total_coins: 0 })
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'STARTED',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await expect(store.completeTask('12')).resolves.toBe(false)
    expect(store.tasks[0]?.status).toBe('STARTED')
  })

  it('計画保存とタスク削除をバックエンドへ同期する', async () => {
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await store.savePlan('06:30', '23:00')
    await store.removeTask('12')

    expect(apiMocks.savePlan).toHaveBeenCalledWith(expect.objectContaining({ wakeTime: '06:30' }))
    expect(apiMocks.deleteTask).toHaveBeenCalledWith('12')
    expect(store.tasks).toHaveLength(0)
  })

  it('タスク削除の同期に失敗したらタスクを戻す', async () => {
    apiMocks.deleteTask.mockRejectedValue(new Error('network error'))
    const store = useQuestStore()
    store.plan.tasks.push({
      id: '12',
      title: '資料を作る',
      taskType: 'DAILY',
      category: 'PC_WORK',
      status: 'TODO',
      estimatedMinutes: 45,
      weight: 3,
      requiredPlace: 'PC',
      scheduledWindow: 'DAYTIME',
    })

    await store.removeTask('12')
    expect(store.tasks[0]?.id).toBe('12')
  })

  it('バトル結果をバックエンドから反映する', async () => {
    apiMocks.battle.mockResolvedValue({ damage: 20, enemyHp: 360 })
    const store = useQuestStore()
    store.game.inventory.push({
      id: 'server-item',
      type: 'SPARK',
      power: 15,
      state: 'AVAILABLE',
      sourceTaskId: '12',
    })

    await expect(store.attack(['server-item'], 'event-1')).resolves.toEqual({ damage: 20, enemyHp: 360 })
    expect(store.game.inventory.find((item) => item.id === 'server-item')?.state).toBe('CONSUMED')
  })

  it('バトル通信失敗時は状態を消費しない', async () => {
    apiMocks.battle.mockRejectedValue(new Error('network error'))
    const store = useQuestStore()
    store.game.inventory.push({
      id: 'server-item',
      type: 'SPARK',
      power: 15,
      state: 'AVAILABLE',
      sourceTaskId: '12',
    })

    await expect(store.attack(['server-item'], 'event-1')).resolves.toEqual({ damage: 0, enemyHp: 0 })
    expect(store.game.inventory.find((item) => item.id === 'server-item')?.state).toBe('AVAILABLE')
  })

  it('バックエンドから計画とゲーム状態を復元する', async () => {
    apiMocks.getPlan.mockResolvedValue({
      localDate: '2026-07-30',
      wakeTime: '06:30',
      sleepTime: '23:00',
      version: 2,
      tasks: [{ id: 12, title: '同期済み', category: 'PC_WORK', status: 'TODO', estimated_minutes: 45, recommended_qr: 'DESK' }],
    })
    apiMocks.getGameState.mockResolvedValue({ level: 2, enemyName: '敵', enemyHp: 10, enemyMaxHp: 20, inventory: [] })
    const store = useQuestStore()

    await store.hydrate()
    expect(store.plan.wakeTime).toBe('06:30')
    expect(store.tasks[0]?.requiredPlace).toBe('PC')
    expect(store.game.enemyHp).toBe(10)
  })
})
