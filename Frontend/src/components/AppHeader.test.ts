import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useQuestStore } from '@/stores/quest'
import AppHeader from './AppHeader.vue'

const RouterLinkStub = {
  props: {
    to: { type: String, required: true },
  },
  template: '<a :href="to"><slot /></a>',
}

describe('AppHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('キャラクター、ゲーム情報、ホームと通知設定への導線を表示する', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.game.level = 12
    store.game.coins = 1240
    const wrapper = mount(AppHeader, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: RouterLinkStub },
      },
    })

    expect(wrapper.get('.app-header__level .app-header__visible-value').text()).toBe('Lv.12')
    expect(wrapper.get('.app-header__coins .app-header__visible-value').text()).toBe('1,240')
    expect(wrapper.get('img').attributes()).toMatchObject({ src: '/assets/hero.png', alt: '' })
    expect(wrapper.get('a[aria-label="ホームを開く"]').attributes('href')).toBe('/home')
    expect(wrapper.get('a[aria-label="通知設定を開く"]').attributes('href')).toBe('/settings')
    expect(wrapper.get('.app-header__level .app-header__sr-only').text()).toBe('レベル 12')
    expect(wrapper.get('.app-header__coins .app-header__sr-only').text()).toBe('コイン 1,240')
    expect(wrapper.get('.app-header__coins').attributes('aria-label')).toBeUndefined()
  })

  it('旧ブランド、同期状態、未読バッジを通知リンク内に表示しない', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AppHeader, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: RouterLinkStub },
      },
    })

    expect(wrapper.text()).not.toContain('MorningQuest')
    expect(wrapper.text()).not.toContain('API接続')
    expect(wrapper.text()).not.toContain('オフライン')
    expect(wrapper.find('[aria-label="通知履歴"]').exists()).toBe(false)
    const notification = wrapper.get('a[aria-label="通知設定を開く"]')
    expect(notification.text()).toBe('')
    expect(notification.findAll('svg')).toHaveLength(1)
    expect(notification.find('span').exists()).toBe(false)
  })

  it('大きなレベルとコインを省略表示してもアクセシブルなフル値を保持する', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.game.level = 123
    store.game.coins = 123_456
    const wrapper = mount(AppHeader, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: RouterLinkStub },
      },
    })

    expect(wrapper.get('.app-header__level .app-header__visible-value').text()).toBe('Lv.99+')
    expect(wrapper.get('.app-header__level .app-header__visible-value').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.app-header__level .app-header__sr-only').text()).toBe('レベル 123')
    expect(wrapper.get('.app-header__coins .app-header__visible-value').text()).toBe('12万+')
    expect(wrapper.get('.app-header__coins .app-header__visible-value').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.app-header__coins .app-header__sr-only').text()).toBe('コイン 123,456')
  })
})
