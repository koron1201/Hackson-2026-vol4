import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BottomNav from './BottomNav.vue'

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to" :data-to="to"><slot /></a>',
}

describe('BottomNav', () => {
  it('主要4画面を決められた順序とラベルで案内する', () => {
    const wrapper = mount(BottomNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('メインナビゲーション')
    expect(wrapper.findAll('a').map((link) => link.attributes('data-to'))).toEqual([
      '/home',
      '/tasks',
      '/battle',
      '/plan',
    ])
    expect(wrapper.findAll('a').map((link) => link.get('small').text())).toEqual([
      'ホーム',
      'クエスト',
      'バトル',
      '計画',
    ])
  })

  it('端末依存の記号ではなく統一SVGアイコンを装飾として表示する', () => {
    const wrapper = mount(BottomNav, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const icons = wrapper.findAll('.bottom-nav__icon')

    expect(icons).toHaveLength(4)
    for (const icon of icons) {
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(icon.get('svg').attributes()).toMatchObject({
        viewBox: '0 0 24 24',
        focusable: 'false',
      })
    }
    expect(wrapper.text()).not.toMatch(/[⌂☷⚔✎]/)
  })
})
