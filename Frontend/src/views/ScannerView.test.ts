import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuestStore } from '@/stores/quest'
import type { QuestTask } from '@/domain/types'
import ScannerView from './ScannerView.vue'

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
  route: { query: { taskId: 'target-task' } },
}))

const zxingMocks = vi.hoisted(() => ({
  decodeFromVideoDevice: vi.fn(),
  listVideoInputDevices: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routerMocks.route,
  useRouter: () => ({ back: routerMocks.back, replace: routerMocks.replace }),
}))

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    static listVideoInputDevices = zxingMocks.listVideoInputDevices
    decodeFromVideoDevice = zxingMocks.decodeFromVideoDevice
  },
}))

const tasks: QuestTask[] = [
  {
    id: 'target-task',
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
    id: 'todo-task',
    title: '散歩する',
    taskType: 'DAILY',
    category: 'EXERCISE',
    status: 'TODO',
    estimatedMinutes: 20,
    weight: 2,
    requiredPlace: 'ENTRANCE',
    scheduledWindow: 'DAYTIME',
  },
  {
    id: 'started-task',
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
    id: 'done-task',
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
    id: 'skipped-task',
    title: '読書する',
    taskType: 'DAILY',
    category: 'OTHER',
    status: 'SKIPPED',
    estimatedMinutes: 15,
    weight: 1,
    requiredPlace: 'NONE',
    scheduledWindow: 'EVENING',
  },
]

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function mountScanner() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useQuestStore(pinia)
  store.plan.tasks = structuredClone(tasks)
  const wrapper = mount(ScannerView, { global: { plugins: [pinia] } })
  await flushPromises()
  return { store, wrapper }
}

function scanCallback() {
  return zxingMocks.decodeFromVideoDevice.mock.calls[0]?.[2] as
    | ((result: { getText: () => string }) => void)
    | undefined
}

describe('ScannerView', () => {
  let stop: ReturnType<typeof vi.fn>
  let vibrate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    stop = vi.fn()
    vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
    routerMocks.back.mockReset()
    routerMocks.replace.mockReset()
    zxingMocks.listVideoInputDevices.mockReset().mockResolvedValue([
      { deviceId: 'rear-camera', label: 'Back Camera' },
    ])
    zxingMocks.decodeFromVideoDevice.mockReset().mockResolvedValue({ stop })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('成功時にカメラを止め、2.8秒だけキャラ・対象タスク・今日の未完了数を表示して一度遷移する', async () => {
    const { store, wrapper } = await mountScanner()
    vi.spyOn(store, 'verifyQrForTaskWithOutcome').mockResolvedValue('VERIFIED')

    scanCallback()?.({ getText: () => 'sensitive-qr-value' })
    await flushPromises()

    const success = wrapper.get('[role="status"]')
    expect(success.attributes('aria-live')).toBe('polite')
    expect(success.text()).toContain('読み取り成功')
    expect(success.text()).toContain('「レポートの構成を書く」を開始')
    expect(success.text()).toContain('今日の未完了 3件')
    expect(success.text()).toContain('約3秒後にタスク一覧へ進みます')
    expect(wrapper.text()).not.toContain('sensitive-qr-value')
    expect(success.get('img').attributes()).toMatchObject({ src: '/assets/hero.png', alt: '' })
    expect(wrapper.find('.scanner-copy').exists()).toBe(false)
    expect(wrapper.find('.scan-frame').exists()).toBe(false)
    expect(wrapper.find('.scanner-actions').exists()).toBe(false)
    expect(stop).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_799)
    expect(routerMocks.replace).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(routerMocks.replace).toHaveBeenCalledTimes(1)
    expect(routerMocks.replace).toHaveBeenCalledWith('/tasks')
  })

  it('高速な重複読み取りでも検証と遷移を一度だけ行う', async () => {
    const { store } = await mountScanner()
    const verify = vi.spyOn(store, 'verifyQrForTaskWithOutcome').mockResolvedValue('VERIFIED')
    const callback = scanCallback()

    callback?.({ getText: () => 'first-value' })
    callback?.({ getText: () => 'second-value' })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2_800)

    expect(verify).toHaveBeenCalledTimes(1)
    expect(routerMocks.replace).toHaveBeenCalledTimes(1)
  })

  it('不一致では警告を示し、カメラと画面を維持して再試行できる', async () => {
    const { store, wrapper } = await mountScanner()
    const verify = vi
      .spyOn(store, 'verifyQrForTaskWithOutcome')
      .mockResolvedValueOnce('MISMATCH')
      .mockResolvedValueOnce('VERIFIED')
    const callback = scanCallback()

    callback?.({ getText: () => 'mismatch-value' })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('PC前のQRではありません。')
    expect(wrapper.find('.scan-frame').exists()).toBe(true)
    expect(stop).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()

    callback?.({ getText: () => 'retry-value' })
    await flushPromises()
    expect(verify).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('成功タイマーの完了前に破棄された場合は遷移せず、カメラを停止する', async () => {
    const { store, wrapper } = await mountScanner()
    vi.spyOn(store, 'verifyQrForTaskWithOutcome').mockResolvedValue('VERIFIED')

    scanCallback()?.({ getText: () => 'valid-value' })
    await flushPromises()
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(2_800)

    expect(stop).toHaveBeenCalledTimes(1)
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('カメラ起動Promiseの解決前に破棄されても、後から得たcontrolsを即停止する', async () => {
    const pendingControls = deferred<{ stop: ReturnType<typeof vi.fn> }>()
    zxingMocks.decodeFromVideoDevice.mockReturnValue(pendingControls.promise)
    const { wrapper } = await mountScanner()

    wrapper.unmount()
    pendingControls.resolve({ stop })
    await flushPromises()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('成功がカメラ起動Promiseより先でも、後から得たcontrolsを停止して成功表示を保つ', async () => {
    const pendingControls = deferred<{ stop: ReturnType<typeof vi.fn> }>()
    zxingMocks.decodeFromVideoDevice.mockReturnValue(pendingControls.promise)
    const { store, wrapper } = await mountScanner()
    vi.spyOn(store, 'verifyQrForTaskWithOutcome').mockResolvedValue('VERIFIED')

    scanCallback()?.({ getText: () => 'valid-value' })
    await flushPromises()
    pendingControls.resolve({ stop })
    await flushPromises()

    expect(stop).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('.scan-frame').exists()).toBe(false)
  })

  it('検証が予期せず失敗してもロックを解除し、内部詳細を含まないエラーで再試行できる', async () => {
    const { store, wrapper } = await mountScanner()
    const verify = vi
      .spyOn(store, 'verifyQrForTaskWithOutcome')
      .mockRejectedValueOnce(new Error('private backend detail'))
      .mockResolvedValueOnce('MISMATCH')
    const callback = scanCallback()

    callback?.({ getText: () => 'first-value' })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('QRコードを確認できませんでした。もう一度お試しください。')
    expect(wrapper.text()).not.toContain('private backend detail')

    callback?.({ getText: () => 'second-value' })
    await flushPromises()
    expect(verify).toHaveBeenCalledTimes(2)
  })

  it('通信不能はQR不一致と区別し、再試行可能な汎用エラーを表示する', async () => {
    const { store, wrapper } = await mountScanner()
    vi.spyOn(store, 'verifyQrForTaskWithOutcome').mockResolvedValue('UNAVAILABLE')

    scanCallback()?.({ getText: () => 'unavailable-value' })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'QRコードを確認できませんでした。通信状態を確認して、もう一度お試しください。',
    )
    expect(wrapper.text()).not.toContain('PC前のQRではありません。')
    expect(wrapper.find('.scan-frame').exists()).toBe(true)
    expect(stop).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })
})
