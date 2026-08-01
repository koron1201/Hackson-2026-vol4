import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuestStore } from '@/stores/quest'
import type { QuestTask } from '@/domain/types'
import HomeView from './HomeView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const RouterLinkStub = {
  props: ['to'],
  template: '<a :data-to="typeof to === \'string\' ? to : to.path"><slot /></a>',
}

const mountedWrappers: ReturnType<typeof mount>[] = []

function createTask(overrides: Partial<QuestTask> = {}): QuestTask {
  return {
    id: 'task-1',
    title: 'レポートの構成を書く',
    taskType: 'DAILY',
    category: 'PC_WORK',
    status: 'TODO',
    estimatedMinutes: 45,
    weight: 3,
    requiredPlace: 'PC',
    scheduledWindow: 'DAYTIME',
    ...overrides,
  }
}

function mountHome(tasks?: QuestTask[], backendEnabled = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useQuestStore(pinia)
  if (tasks) store.plan.tasks = tasks
  store.backendEnabled = backendEnabled

  const wrapper = mount(HomeView, {
    global: {
      plugins: [pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  mountedWrappers.push(wrapper)

  return {
    store,
    wrapper,
  }
}

describe('HomeView', () => {
  beforeEach(() => {
    push.mockReset()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('選択中の表示フェーズをaria-pressedで伝える', async () => {
    const { wrapper } = mountHome()
    const buttons = wrapper.findAll('.phase-switcher button')
    const morning = buttons.find((button) => button.text() === '朝')
    const daytime = buttons.find((button) => button.text() === '日中')

    await morning?.trigger('click')
    expect(morning?.attributes('aria-pressed')).toBe('true')
    expect(daytime?.attributes('aria-pressed')).toBe('false')

    await daytime?.trigger('click')
    expect(morning?.attributes('aria-pressed')).toBe('false')
    expect(daytime?.attributes('aria-pressed')).toBe('true')
  })

  it('優先順位どおり progress、mission、forecast、companion、battle を直下に表示する', () => {
    const { wrapper } = mountHome()

    expect(wrapper.findAll('.home-grid > section').map((section) => section.classes())).toEqual([
      expect.arrayContaining(['progress-card']),
      expect.arrayContaining(['mission-card']),
      expect.arrayContaining(['forecast-card']),
      expect.arrayContaining(['companion-banner']),
      expect.arrayContaining(['battle-teaser']),
    ])
  })

  it('TODOミッションは場所と状態を示し、QRスキャンへ進む唯一のCTAを持つ', async () => {
    const { wrapper } = mountHome([createTask()])

    expect(wrapper.get('.mission-card').text()).toContain('未着手')
    expect(wrapper.get('.mission-card').text()).toContain('PC前')
    const cta = wrapper.get('.mission-card button')
    expect(cta.text()).toContain('QRをスキャンする')
    expect(cta.attributes('aria-label')).toContain('レポートの構成を書く')
    expect(wrapper.findAll('.mission-card button')).toHaveLength(1)
    expect(wrapper.find('.companion-banner button').exists()).toBe(false)

    await cta.trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/scanner', query: { taskId: 'task-1' } })
  })

  it('開始済みミッションはタスク一覧で続けるCTAを表示する', async () => {
    const { wrapper } = mountHome([createTask({ status: 'STARTED', requiredPlace: 'NONE' })])

    const cta = wrapper.get('.mission-card button')
    expect(wrapper.get('.mission-card').text()).toContain('進行中')
    expect(cta.text()).toContain('タスク一覧で続ける')
    await cta.trigger('click')
    expect(push).toHaveBeenCalledWith('/tasks')
  })

  it('場所指定なしの未着手ミッションは画面内で開始する', async () => {
    const { store, wrapper } = mountHome([createTask({ requiredPlace: 'NONE' })])

    const cta = wrapper.get('.mission-card button')
    expect(cta.text()).toContain('クエストを始める')
    await cta.trigger('click')

    expect(store.tasks[0]?.status).toBe('STARTED')
    expect(push).not.toHaveBeenCalled()
  })

  it('破棄時に時刻更新intervalを解除する', () => {
    const clearInterval = vi.spyOn(window, 'clearInterval')
    const { wrapper } = mountHome()

    wrapper.unmount()

    expect(clearInterval).toHaveBeenCalledOnce()
    clearInterval.mockRestore()
  })

  it('長い英数字のミッション名も省略せず表示する', () => {
    const longTitle = 'VERY-LONG-UNBROKEN-MISSION-TITLE-'.repeat(8)
    const { wrapper } = mountHome([createTask({ title: longTitle })])

    expect(wrapper.get('.mission-card h3').text()).toBe(longTitle)
  })

  it('全タスク完了時は完了を示しCTAを表示しない', () => {
    const { wrapper } = mountHome([createTask({ status: 'DONE' })])

    expect(wrapper.get('.mission-card').text()).toContain('本日のミッション完了')
    expect(wrapper.find('.mission-card button').exists()).toBe(false)
  })

  it('全タスクをスキップした日は完了と誤表示しない', () => {
    const { wrapper } = mountHome([createTask({ status: 'SKIPPED' })])

    expect(wrapper.get('.mission-card').text()).toContain('今日はここまで')
    expect(wrapper.get('.mission-card').text()).not.toContain('本日のミッション完了')
    expect(wrapper.get('.companion-banner').text()).not.toContain('あと1つ')
  })

  it('計画が空なら完了と誤表示せず、計画作成への導線を表示する', () => {
    const { wrapper } = mountHome([])

    expect(wrapper.get('.mission-card').text()).toContain('今日の計画を作ろう')
    expect(wrapper.get('.mission-card').text()).not.toContain('本日のミッション完了')
    expect(wrapper.get('.mission-card a').attributes('data-to')).toBe('/plan')
  })

  it('バックエンド時は報酬を最後に表示し、バトル予告を置き換える', () => {
    const { wrapper } = mountHome([createTask()], true)

    expect(wrapper.find('.home-grid > .backend-reward-card').exists()).toBe(true)
    expect(wrapper.find('.home-grid > .battle-teaser').exists()).toBe(false)
    expect(wrapper.find('.home-grid > section:last-child').classes()).toContain('backend-reward-card')
  })

  it('バトル予告に統一した敵素材を表示し、旧絵文字は表示しない', () => {
    const { wrapper } = mountHome()

    expect(wrapper.get('.battle-teaser__enemy img').attributes()).toMatchObject({
      src: '/assets/enemy-purple-ogre.png',
      alt: '',
    })
    expect(wrapper.get('.battle-teaser__enemy').text()).not.toContain('🧌')
  })
})
