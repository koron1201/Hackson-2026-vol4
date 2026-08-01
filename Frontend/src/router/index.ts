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
  router.beforeEach((to) => {
    const store = useQuestStore()
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
    if (!to.meta.public && !store.isAuthenticated) return '/login'
  })

  return router
}

const router = createAppRouter()
export default router
