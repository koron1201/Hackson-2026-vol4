import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'

vi.mock('@/services/apiClient', () => ({
  apiClient: {},
  isBackendConfigured: true,
  setAccessToken: vi.fn(),
}))

import { useQuestStore } from '@/stores/quest'
import { createAppRouter } from './index'

describe('router authentication guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('未認証で保護ルートを直接開くとログインへリダイレクトする', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/home')

    expect(router.currentRoute.value.fullPath).toBe('/login')
  })

  it('公開ルートは未認証でも表示できる', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/login')

    expect(router.currentRoute.value.fullPath).toBe('/login')
  })

  it('認証済みなら保護ルートへ遷移できる', async () => {
    const store = useQuestStore()
    store.isAuthenticated = true
    const router = createAppRouter(createMemoryHistory())

    await router.push('/tasks')

    expect(router.currentRoute.value.fullPath).toBe('/tasks')
  })

  it('保護ルート表示中にsessionが失効したらログインへ戻す', async () => {
    const store = useQuestStore()
    store.startBackendSession('利用者')
    const router = createAppRouter(createMemoryHistory())
    await router.push('/tasks')

    store.logoutBackendSession()

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/login'))
  })

  it('公開ログインrouteでは未認証通知によるredirect loopを起こさない', async () => {
    const store = useQuestStore()
    const router = createAppRouter(createMemoryHistory())
    await router.push('/login')

    store.setAuthenticated(false)

    await Promise.resolve()
    expect(router.currentRoute.value.fullPath).toBe('/login')
  })
})
