import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestStore } from '@/stores/quest'
import LoginView from './LoginView.vue'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
  getPlan: vi.fn(),
  getGameState: vi.fn(),
  setAccessToken: vi.fn(),
}))
const { replace, login, me, getPlan, getGameState, setAccessToken } = mocks

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/services/apiClient', () => ({
  isBackendConfigured: false,
  apiClient: {
    login: mocks.login,
    me: mocks.me,
    getPlan: mocks.getPlan,
    getGameState: mocks.getGameState,
  },
  setAccessToken: mocks.setAccessToken,
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    replace.mockReset()
    login.mockReset()
    me.mockReset()
    getPlan.mockReset()
    getGameState.mockReset()
    setAccessToken.mockReset()
    me.mockResolvedValue({ id: 1, name: 'ゆうき', email: 'you@example.com' })
    getPlan.mockRejectedValue(new Error('plan unavailable'))
    getGameState.mockRejectedValue(new Error('game unavailable'))
  })

  it('バックエンドモードではtoken設定後にhydrateしてからホームへ進む', async () => {
    login.mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, name: 'ゆうき', email: 'you@example.com' },
    })
    getPlan.mockResolvedValue({
      localDate: '2026-07-31',
      wakeTime: '06:30',
      sleepTime: '23:00',
      version: 2,
      tasks: [],
    })
    getGameState.mockResolvedValue({
      level: 2,
      coins: 30,
      streakDays: 1,
      enemyName: '敵',
      enemyHp: 10,
      enemyMaxHp: 20,
      inventory: [],
    })
    const store = useQuestStore()
    store.backendEnabled = true
    store.isAuthenticated = false
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="email"]').setValue('you@example.com')
    await wrapper.get('input[type="password"]').setValue('password123')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(login).toHaveBeenCalledWith('you@example.com', 'password123')
    expect(setAccessToken).toHaveBeenCalledWith('test-token')
    expect(me).toHaveBeenCalledOnce()
    expect(getPlan).toHaveBeenCalledOnce()
    expect(getGameState).toHaveBeenCalledOnce()
    expect(setAccessToken.mock.invocationCallOrder[0]).toBeLessThan(
      me.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    expect(me.mock.invocationCallOrder[0]).toBeLessThan(
      getPlan.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    expect(store.game.coins).toBe(30)
    expect(localStorage.getItem('morningquest-backend')).toBeNull()
  })

  it('/auth/meが401ならtokenとsessionを破棄して遷移しない', async () => {
    login.mockResolvedValue({
      accessToken: 'rejected-token',
      user: { id: 1, name: 'ゆうき', email: 'you@example.com' },
    })
    me.mockRejectedValue({ status: 401, message: '認証または権限を確認してください。' })
    const store = useQuestStore()
    store.backendEnabled = true
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="email"]').setValue('you@example.com')
    await wrapper.get('input[type="password"]').setValue('password123')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('認証'))
    expect(setAccessToken).toHaveBeenNthCalledWith(1, 'rejected-token')
    expect(setAccessToken).toHaveBeenLastCalledWith(null)
    expect(store.isAuthenticated).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it('hydrateで401になりauth falseならホームへ遷移しない', async () => {
    login.mockResolvedValue({
      accessToken: 'expired-token',
      user: { id: 1, name: 'ゆうき', email: 'you@example.com' },
    })
    getPlan.mockRejectedValue({ status: 401 })
    getGameState.mockResolvedValue({})
    const store = useQuestStore()
    store.backendEnabled = true
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="email"]').setValue('you@example.com')
    await wrapper.get('input[type="password"]').setValue('password123')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(store.isAuthenticated).toBe(false))
    expect(setAccessToken).toHaveBeenLastCalledWith(null)
    expect(replace).not.toHaveBeenCalled()
  })

  it('ログイン処理中はゲスト切替を無効化する', async () => {
    let resolveLogin!: (value: {
      accessToken: string
      user: { id: number; name: string; email: string }
    }) => void
    login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    const store = useQuestStore()
    store.backendEnabled = true
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="email"]').setValue('you@example.com')
    await wrapper.get('input[type="password"]').setValue('password123')
    await wrapper.get('form').trigger('submit')
    const guestButton = wrapper.get('[data-testid="guest-login"]')

    expect(guestButton.attributes('disabled')).toBeDefined()
    await guestButton.trigger('click')
    expect(store.backendEnabled).toBe(true)
    expect(replace).not.toHaveBeenCalled()

    resolveLogin({
      accessToken: 'test-token',
      user: { id: 1, name: 'ゆうき', email: 'you@example.com' },
    })
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
  })

  it('入力が短い場合はAPIへ送信せずエラーを表示する', async () => {
    const store = useQuestStore()
    store.backendEnabled = true
    const wrapper = mount(LoginView)

    await wrapper.get('input[type="email"]').setValue('you@example.com')
    await wrapper.get('input[type="password"]').setValue('short')
    await wrapper.get('form').trigger('submit')

    expect(login).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('8文字以上')
    expect(replace).not.toHaveBeenCalled()
  })

  it('入力なしのゲスト導線でローカルデモへ進む', async () => {
    const store = useQuestStore()
    store.backendEnabled = true
    store.isAuthenticated = false
    const wrapper = mount(LoginView)

    await wrapper.get('[data-testid="guest-login"]').trigger('click')

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(login).not.toHaveBeenCalled()
    expect(setAccessToken).toHaveBeenCalledWith(null)
    expect(store.backendEnabled).toBe(false)
    expect(store.tasks.length).toBeGreaterThan(0)
  })
})
