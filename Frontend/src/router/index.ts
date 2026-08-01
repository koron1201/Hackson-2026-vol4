import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import { useQuestStore } from '@/stores/quest'

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    scrollBehavior: () => ({ top: 0 }),
    routes: [
      {
        path: '/',
        redirect: '/home',
      },
      {
        path: '/login',
        component: () => import('@/views/LoginView.vue'),
        meta: { hideChrome: true, public: true },
      },
      {
        path: '/onboarding',
        component: () => import('@/views/OnboardingView.vue'),
        meta: { hideChrome: true },
      },
      {
        path: '/home',
        component: () => import('@/views/HomeView.vue'),
      },
      {
        path: '/plan',
        component: () => import('@/views/PlanView.vue'),
      },
      {
        path: '/tasks',
        component: () => import('@/views/TasksView.vue'),
      },
      {
        path: '/scanner',
        component: () => import('@/views/ScannerView.vue'),
        meta: { hideChrome: true },
      },
      {
        path: '/ar-summon',
        component: () => import('@/views/ArSummonView.vue'),
        meta: { hideChrome: true },
      },
      {
        path: '/alarm/:alarmId',
        component: () => import('@/views/AlarmView.vue'),
        meta: { hideChrome: true },
      },
      {
        path: '/battle',
        component: () => import('@/views/BattleView.vue'),
      },
      {
        path: '/settings',
        component: () => import('@/views/SettingsView.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        redirect: '/home',
      },
    ],
  })

  let stopAuthSync: (() => void) | null = null

  router.beforeEach(async (to) => {
    const store = useQuestStore()

    // 💡【最重要ポイント】トークンが存在し、かつ未認証状態なら先に hydrate()（自動ログイン）を完了させる
    const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'))
    if (hasToken && !store.isAuthenticated) {
      try {
        await store.hydrate()
      } catch (e) {
        console.warn('自動ログインの復元に失敗しました:', e)
      }
    }

    if (!stopAuthSync) {
      stopAuthSync = store.$subscribe(
        (_mutation, state) => {
          const currentRoute = router.currentRoute.value
          if (
            !state.isAuthenticated &&
            currentRoute.matched.length > 0 &&
            !currentRoute.meta.public
          ) {
            void router.replace('/login')
          }
        },
        { flush: 'sync' },
      )
    }

    // 認証チェック：未ログインで保護されたページへ行こうとした場合のみ /login へリダイレクト
    if (!to.meta.public && !store.isAuthenticated) {
      return '/login'
    }

    // 既にログイン済みで /login にアクセスした場合は /home へリダイレクト
    if (to.path === '/login' && store.isAuthenticated) {
      return '/home'
    }
  })

  return router
}

const router = createAppRouter()
export default router