import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestStore } from '@/stores/quest'
import LoginView from './LoginView.vue'

const replace = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}))

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    replace.mockReset()
  })

  it('バックエンドモードでは接続確認後にホームへ進む', async () => {
    const store = useQuestStore()
    store.backendEnabled = true
    store.isAuthenticated = false
    const connectBackend = vi.spyOn(store, 'connectBackend').mockResolvedValue(true)
    const wrapper = mount(LoginView)

    expect(wrapper.text()).toContain('バックエンドへ接続')
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)

    await wrapper.get('button[data-testid="connect-backend"]').trigger('click')
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(connectBackend).toHaveBeenCalledOnce()
  })

  it('接続失敗時はエラーを表示して遷移しない', async () => {
    const store = useQuestStore()
    store.backendEnabled = true
    vi.spyOn(store, 'connectBackend').mockResolvedValue(false)
    const wrapper = mount(LoginView)

    await wrapper.get('button[data-testid="connect-backend"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('接続できません'))
    expect(replace).not.toHaveBeenCalled()
  })
})
