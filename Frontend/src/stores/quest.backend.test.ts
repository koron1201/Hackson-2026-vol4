import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const apiMocks = vi.hoisted(() => ({
  health: vi.fn(),
  setAccessToken: vi.fn(),
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
  setAccessToken: apiMocks.setAccessToken,
}))

import { useQuestStore } from './quest'

type BackendStore = ReturnType<typeof useQuestStore>

function addTaskFixture(store: BackendStore, status: 'TODO' | 'STARTED' = 'TODO') {
  store.plan.tasks.push({
    id: '12',
    title: '同期タスク',
    taskType: 'DAILY',
    category: 'OTHER',
    status,
    estimatedMinutes: 15,
    weight: 1,
    requiredPlace: 'NONE',
    scheduledWindow: 'DAYTIME',
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

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

  it('接続確認に成功しても認証済みにはしない', async () => {
    apiMocks.health.mockResolvedValue({ message: 'MorningQuest API is running!' })
    const store = useQuestStore()

    await expect(store.connectBackend()).resolves.toBe(true)
    expect(store.isAuthenticated).toBe(false)
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

  it('未認証ではbackendスナップショットを破棄しplan/game APIも呼ばない', async () => {
    localStorage.setItem(
      'morningquest-backend',
      JSON.stringify({
        userName: '以前の利用者',
        isAuthenticated: true,
        plan: {
          localDate: '2026-07-30',
          wakeTime: '05:00',
          sleepTime: '22:00',
          version: 9,
          tasks: [{ id: 'previous-user-task', title: '以前のタスク' }],
        },
        game: { level: 99, processedBattles: { old: true } },
      }),
    )
    const store = useQuestStore()

    await store.hydrate()

    expect(store.isAuthenticated).toBe(false)
    expect(store.userName).toBe('Hero')
    expect(store.tasks).toEqual([])
    expect(store.processedBattles).toEqual({})
    expect(apiMocks.getPlan).not.toHaveBeenCalled()
    expect(apiMocks.getGameState).not.toHaveBeenCalled()
    expect(localStorage.getItem('morningquest-backend')).toBeNull()
  })

  it('backendモードでは個人データをlocalStorageへ永続化しない', () => {
    const store = useQuestStore()
    store.isAuthenticated = true
    store.userName = '保存しない利用者'

    store.persist()

    expect(localStorage.getItem('morningquest-backend')).toBeNull()
  })

  it('ログアウトでtokenとbackendセッションだけを初期化する', () => {
    localStorage.setItem('morningquest-demo', '{"keep":"demo"}')
    const store = useQuestStore()
    store.isAuthenticated = true
    store.userName = '利用者A'
    store.plan.tasks.push({
      id: '12',
      title: '利用者Aのタスク',
      taskType: 'DAILY',
      category: 'OTHER',
      status: 'TODO',
      estimatedMinutes: 15,
      weight: 1,
      requiredPlace: 'NONE',
      scheduledWindow: 'DAYTIME',
    })
    store.game.coins = 100
    store.processedBattles.event = { damage: 10, enemyHp: 90 }
    store.persist()

    store.logoutBackendSession()

    expect(apiMocks.setAccessToken).toHaveBeenCalledWith(null)
    expect(store.isAuthenticated).toBe(false)
    expect(store.userName).toBe('Hero')
    expect(store.tasks).toEqual([])
    expect(store.game.coins).toBe(0)
    expect(store.processedBattles).toEqual({})
    expect(localStorage.getItem('morningquest-backend')).toBeNull()
    expect(localStorage.getItem('morningquest-demo')).toBe('{"keep":"demo"}')
  })

  it('新しいbackendセッション開始時に以前の利用者データを混在させない', () => {
    const store = useQuestStore()
    store.userName = '以前の利用者'
    store.plan.tasks.push({
      id: 'old-task',
      title: '以前のタスク',
      taskType: 'DAILY',
      category: 'OTHER',
      status: 'TODO',
      estimatedMinutes: 15,
      weight: 1,
      requiredPlace: 'NONE',
      scheduledWindow: 'DAYTIME',
    })
    store.game.coins = 100
    store.processedBattles.oldEvent = { damage: 10, enemyHp: 90 }

    store.startBackendSession('新しい利用者')

    expect(store.isAuthenticated).toBe(true)
    expect(store.userName).toBe('新しい利用者')
    expect(store.tasks).toEqual([])
    expect(store.game.coins).toBe(0)
    expect(store.processedBattles).toEqual({})
  })

  it('ゲスト切替時にstale backend keyを破棄してdemo保存は維持する', () => {
    localStorage.setItem('morningquest-backend', '{"stale":"personal-data"}')
    const store = useQuestStore()
    store.processedBattles.oldEvent = { damage: 10, enemyHp: 90 }

    store.enterDemoMode()

    expect(localStorage.getItem('morningquest-backend')).toBeNull()
    expect(localStorage.getItem('morningquest-demo')).not.toBeNull()
    expect(store.processedBattles).toEqual({})
  })

  it.each([
    ['401', 401, false, ''],
    ['403', 403, true, '権限'],
    ['network', 0, true, '同期'],
    ['server', 500, true, '同期'],
  ] as const)(
    'hydrateの%sエラーを認証状態と表示へ正しく反映する',
    async (_label, status, expectedAuthenticated, message) => {
      apiMocks.getPlan.mockRejectedValue({ status })
      apiMocks.getGameState.mockResolvedValue({})
      const store = useQuestStore()
      store.startBackendSession('利用者')

      await store.hydrate()

      expect(store.isAuthenticated).toBe(expectedAuthenticated)
      if (message) expect(store.toast).toContain(message)
      if (status === 401) expect(apiMocks.setAccessToken).toHaveBeenCalledWith(null)
    },
  )

  it('古いhydrate応答をguest・logout・新login後のsessionへ反映しない', async () => {
    const transitions = [
      (store: ReturnType<typeof useQuestStore>) => store.enterDemoMode(),
      (store: ReturnType<typeof useQuestStore>) => store.logoutBackendSession(),
      (store: ReturnType<typeof useQuestStore>) => store.startBackendSession('新しい利用者'),
    ]

    for (const transition of transitions) {
      setActivePinia(createPinia())
      let resolvePlan!: (value: unknown) => void
      let resolveGame!: (value: unknown) => void
      apiMocks.getPlan.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePlan = resolve
        }),
      )
      apiMocks.getGameState.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGame = resolve
        }),
      )
      const store = useQuestStore()
      store.startBackendSession('以前の利用者')
      const hydration = store.hydrate()

      transition(store)
      resolvePlan({
        localDate: '2026-07-31',
        wakeTime: '05:00',
        sleepTime: '22:00',
        version: 9,
        tasks: [{ id: 'old-task', title: '古い応答' }],
      })
      resolveGame({ coins: 999 })
      await hydration

      expect(store.tasks.some((task) => task.id === 'old-task')).toBe(false)
      expect(store.game.coins).not.toBe(999)
      expect(localStorage.getItem('morningquest-backend')).toBeNull()
    }
  })

  it('backendの端末データ初期化はtokenとsessionを破棄する', () => {
    const store = useQuestStore()
    store.startBackendSession('利用者')
    store.game.coins = 100

    store.resetLocalData()

    expect(apiMocks.setAccessToken).toHaveBeenCalledWith(null)
    expect(store.isAuthenticated).toBe(false)
    expect(store.game.coins).toBe(0)
  })

  it('全session-bound操作の401でtokenとsessionを破棄する', async () => {
    const operations: Array<{
      name: string
      run: (store: BackendStore) => Promise<unknown>
    }> = [
      {
        name: 'start',
        run: (store) => {
          addTaskFixture(store)
          apiMocks.updateTaskStatus.mockRejectedValueOnce({ status: 401 })
          return store.startTask('12')
        },
      },
      {
        name: 'complete',
        run: (store) => {
          addTaskFixture(store, 'STARTED')
          apiMocks.completeTask.mockRejectedValueOnce({ status: 401 })
          return store.completeTask('12')
        },
      },
      {
        name: 'add-analysis',
        run: (store) => {
          apiMocks.analyzeTask.mockRejectedValueOnce({ status: 401 })
          return store.addTask('追加タスク')
        },
      },
      {
        name: 'add-create',
        run: (store) => {
          apiMocks.analyzeTask.mockResolvedValueOnce(null)
          apiMocks.createTask.mockRejectedValueOnce({ status: 401 })
          return store.addTask('追加タスク')
        },
      },
      {
        name: 'qr',
        run: (store) => {
          addTaskFixture(store)
          store.plan.tasks[0]!.requiredPlace = 'PC'
          apiMocks.verifyQr.mockRejectedValueOnce({ status: 401 })
          return store.verifyQrForTask('DESK', '12')
        },
      },
      {
        name: 'remove',
        run: (store) => {
          addTaskFixture(store)
          apiMocks.deleteTask.mockRejectedValueOnce({ status: 401 })
          return store.removeTask('12')
        },
      },
      {
        name: 'save',
        run: (store) => {
          apiMocks.savePlan.mockRejectedValueOnce({ status: 401 })
          return store.savePlan('06:30', '23:00')
        },
      },
      {
        name: 'battle',
        run: (store) => {
          apiMocks.battle.mockRejectedValueOnce({ status: 401 })
          return store.attack([], 'event-401')
        },
      },
    ]

    for (const operation of operations) {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      const store = useQuestStore()
      store.startBackendSession('利用者')

      await operation.run(store).catch(() => undefined)

      expect(store.isAuthenticated, operation.name).toBe(false)
      expect(apiMocks.setAccessToken, operation.name).toHaveBeenCalledWith(null)
    }
  })

  it.each([403, 500, 0])(
    'session-bound操作のstatus %iでは認証を維持して既存エラーUXを使う',
    async (status) => {
      apiMocks.completeTask.mockRejectedValueOnce({ status })
      const store = useQuestStore()
      store.startBackendSession('利用者')
      addTaskFixture(store, 'STARTED')

      await expect(store.completeTask('12')).resolves.toBe(false)

      expect(store.isAuthenticated).toBe(true)
      expect(store.toast).toContain('通信')
      expect(apiMocks.setAccessToken).not.toHaveBeenCalledWith(null)
    },
  )

  it('全session-bound操作の遅延成功を新sessionへ反映しない', async () => {
    const scenarios: Array<{
      name: string
      response: unknown
      start: (store: BackendStore, pending: Promise<unknown>) => Promise<unknown>
    }> = [
      {
        name: 'start',
        response: {
          id: 12,
          title: '古い開始応答',
          category: 'OTHER',
          status: 'STARTED',
          estimated_minutes: 15,
          is_completed: false,
          recommended_qr: null,
        },
        start: (store, pending) => {
          addTaskFixture(store)
          apiMocks.updateTaskStatus.mockReturnValueOnce(pending)
          return store.startTask('12')
        },
      },
      {
        name: 'complete',
        response: { earned_coins: 10, total_coins: 999 },
        start: (store, pending) => {
          addTaskFixture(store, 'STARTED')
          apiMocks.completeTask.mockReturnValueOnce(pending)
          return store.completeTask('12')
        },
      },
      {
        name: 'add-analysis',
        response: { category: 'OTHER', estimated_minutes: 15, recommended_qr: 'DESK' },
        start: (store, pending) => {
          apiMocks.analyzeTask.mockReturnValueOnce(pending)
          return store.addTask('古い追加')
        },
      },
      {
        name: 'qr',
        response: { success: true },
        start: (store, pending) => {
          addTaskFixture(store)
          store.plan.tasks[0]!.requiredPlace = 'PC'
          apiMocks.verifyQr.mockReturnValueOnce(pending)
          return store.verifyQrForTask('DESK', '12')
        },
      },
      {
        name: 'remove',
        response: { status: 'deleted' },
        start: (store, pending) => {
          addTaskFixture(store)
          apiMocks.deleteTask.mockReturnValueOnce(pending)
          return store.removeTask('12')
        },
      },
      {
        name: 'save',
        response: {
          localDate: '2026-07-31',
          wakeTime: '05:00',
          sleepTime: '22:00',
          version: 9,
          tasks: [],
        },
        start: (store, pending) => {
          apiMocks.savePlan.mockReturnValueOnce(pending)
          return store.savePlan('05:00', '22:00')
        },
      },
      {
        name: 'battle',
        response: { damage: 50, enemyHp: 1 },
        start: (store, pending) => {
          apiMocks.battle.mockReturnValueOnce(pending)
          return store.attack([], 'old-battle')
        },
      },
    ]

    for (const scenario of scenarios) {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      const pending = deferred<unknown>()
      const store = useQuestStore()
      store.startBackendSession('以前の利用者')
      const operation = scenario.start(store, pending.promise)

      store.startBackendSession('新しい利用者')
      pending.resolve(scenario.response)
      await operation.catch(() => undefined)

      expect(store.userName, scenario.name).toBe('新しい利用者')
      expect(store.tasks, scenario.name).toEqual([])
      expect(store.game.coins, scenario.name).toBe(0)
      expect(store.processedBattles, scenario.name).toEqual({})
      expect(store.toast, scenario.name).toBe('')
    }
  })

  it('遅延401失敗は新sessionをlogoutしない', async () => {
    const pending = deferred<never>()
    apiMocks.completeTask.mockReturnValueOnce(pending.promise)
    const store = useQuestStore()
    store.startBackendSession('以前の利用者')
    addTaskFixture(store, 'STARTED')
    const operation = store.completeTask('12')

    store.startBackendSession('新しい利用者')
    pending.reject({ status: 401 })
    await operation

    expect(store.isAuthenticated).toBe(true)
    expect(store.userName).toBe('新しい利用者')
    expect(apiMocks.setAccessToken).not.toHaveBeenCalledWith(null)
  })

  it('全session-bound操作の遅延失敗を新sessionへ反映しない', async () => {
    const scenarios: Array<{
      name: string
      start: (store: BackendStore, pending: Promise<never>) => Promise<unknown>
    }> = [
      {
        name: 'start',
        start: (store, pending) => {
          addTaskFixture(store)
          apiMocks.updateTaskStatus.mockReturnValueOnce(pending)
          return store.startTask('12')
        },
      },
      {
        name: 'complete',
        start: (store, pending) => {
          addTaskFixture(store, 'STARTED')
          apiMocks.completeTask.mockReturnValueOnce(pending)
          return store.completeTask('12')
        },
      },
      {
        name: 'add-analysis',
        start: (store, pending) => {
          apiMocks.analyzeTask.mockReturnValueOnce(pending)
          return store.addTask('古い追加')
        },
      },
      {
        name: 'qr',
        start: (store, pending) => {
          addTaskFixture(store)
          store.plan.tasks[0]!.requiredPlace = 'PC'
          apiMocks.verifyQr.mockReturnValueOnce(pending)
          return store.verifyQrForTask('DESK', '12')
        },
      },
      {
        name: 'remove',
        start: (store, pending) => {
          addTaskFixture(store)
          apiMocks.deleteTask.mockReturnValueOnce(pending)
          return store.removeTask('12')
        },
      },
      {
        name: 'save',
        start: (store, pending) => {
          apiMocks.savePlan.mockReturnValueOnce(pending)
          return store.savePlan('05:00', '22:00')
        },
      },
      {
        name: 'battle',
        start: (store, pending) => {
          apiMocks.battle.mockReturnValueOnce(pending)
          return store.attack([], 'old-battle')
        },
      },
    ]

    for (const scenario of scenarios) {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      const pending = deferred<never>()
      const store = useQuestStore()
      store.startBackendSession('以前の利用者')
      const operation = scenario.start(store, pending.promise)

      store.startBackendSession('新しい利用者')
      pending.reject({ status: 401 })
      await operation.catch(() => undefined)

      expect(store.isAuthenticated, scenario.name).toBe(true)
      expect(store.userName, scenario.name).toBe('新しい利用者')
      expect(store.tasks, scenario.name).toEqual([])
      expect(store.game.coins, scenario.name).toBe(0)
      expect(store.toast, scenario.name).toBe('')
      expect(apiMocks.setAccessToken, scenario.name).not.toHaveBeenCalledWith(null)
    }
  })

  it('タスク作成の遅延失敗を新sessionへ反映しない', async () => {
    const pending = deferred<never>()
    apiMocks.analyzeTask.mockResolvedValueOnce(null)
    apiMocks.createTask.mockReturnValueOnce(pending.promise)
    const store = useQuestStore()
    store.startBackendSession('以前の利用者')
    const operation = store.addTask('古い追加')
    await vi.waitFor(() => expect(apiMocks.createTask).toHaveBeenCalledOnce())

    store.startBackendSession('新しい利用者')
    pending.reject({ status: 401 })
    await operation.catch(() => undefined)

    expect(store.isAuthenticated).toBe(true)
    expect(store.userName).toBe('新しい利用者')
    expect(store.tasks).toEqual([])
    expect(store.toast).toBe('')
    expect(apiMocks.setAccessToken).not.toHaveBeenCalledWith(null)
  })

  it('backendモードで旧resetDemo操作が呼ばれてもtokenとsessionを破棄する', () => {
    const store = useQuestStore()
    store.startBackendSession('利用者')
    store.game.coins = 100

    store.resetDemo()

    expect(apiMocks.setAccessToken).toHaveBeenCalledWith(null)
    expect(store.backendEnabled).toBe(true)
    expect(store.isAuthenticated).toBe(false)
    expect(store.game.coins).toBe(0)
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
    expect(localStorage.getItem('morningquest-backend')).toBeNull()
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
    store.isAuthenticated = true

    await store.hydrate()
    expect(store.plan.wakeTime).toBe('06:30')
    expect(store.tasks[0]?.requiredPlace).toBe('PC')
    expect(store.game.enemyHp).toBe(10)
  })
})
