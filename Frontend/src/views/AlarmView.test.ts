import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuestStore } from '@/stores/quest'
import AlarmView from './AlarmView.vue'

const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const alarmMocks = vi.hoisted(() => ({
  isAlarmAudioActive: vi.fn(() => false),
  startAlarmAudio: vi.fn(async () => true),
  stopAlarmAudio: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => routerMocks }))
vi.mock('@/services/alarmAudio', () => alarmMocks)

describe('AlarmView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerMocks.push.mockReset()
    routerMocks.replace.mockReset()
    alarmMocks.startAlarmAudio.mockClear()
    alarmMocks.stopAlarmAudio.mockClear()
  })

  it('スキャン画面へ移動してもアラーム音を停止しない', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.enterDemoMode()
    const target =
      store.tasks.find((task) => task.requiredPlace === 'WASHROOM' && task.status === 'TODO') ??
      store.nextTask
    const wrapper = mount(AlarmView, { global: { plugins: [pinia] } })

    await wrapper.get('.scan-orb').trigger('click')

    expect(routerMocks.push).toHaveBeenCalledWith({ path: '/scanner', query: { taskId: target?.id, alarm: '1' } })
    expect(alarmMocks.stopAlarmAudio).not.toHaveBeenCalled()
  })
})
