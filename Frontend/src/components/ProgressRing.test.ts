import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProgressRing from './ProgressRing.vue'

describe('ProgressRing', () => {
  it('達成率を視覚表示とアクセシブルな値で伝える', () => {
    const wrapper = mount(ProgressRing, {
      props: {
        percentage: 72,
        completed: 6,
        total: 8,
      },
    })

    const progress = wrapper.get('[role="progressbar"]')
    expect(progress.attributes('aria-valuenow')).toBe('72')
    expect(wrapper.text()).toContain('72%')
    expect(wrapper.text()).toContain('6 / 8')
  })

  it('100を超える値を100へ丸める', () => {
    const wrapper = mount(ProgressRing, {
      props: {
        percentage: 140,
        completed: 4,
        total: 4,
      },
    })

    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
  })
})
