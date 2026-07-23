import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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

export default router
