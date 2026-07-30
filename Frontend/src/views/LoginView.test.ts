import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestStore } from '@/stores/quest'
import LoginView from './LoginView.vue'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
  setAccessToken: vi.fn(),
}))
const { replace, login, setAccessToken } = mocks

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/services/apiClient', () => ({
  isBackendConfigured: false,
  apiClient: { login: mocks.login },
  setAccessToken: mocks.setAccessToken,
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    replace.mockReset()
    login.mockReset()
    setAccessToken.mockReset()
  })

  it('バックエンドモードではログイン成功後にホームへ進む', async () => {
    login.mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, name: 'ゆうき', email: 'you@example.com' },
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
