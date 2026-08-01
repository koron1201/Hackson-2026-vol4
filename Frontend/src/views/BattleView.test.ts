import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuestStore } from '@/stores/quest'
import type { InventoryItem } from '@/domain/types'
import BattleView from './BattleView.vue'

describe('BattleView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('敵と各アイテム種別に統一素材を表示し、旧絵文字は表示しない', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    const inventory: InventoryItem[] = [
      {
        id: 'item-spark',
        type: 'SPARK',
        power: 15,
        state: 'AVAILABLE',
        sourceTaskId: 'habit-breakfast',
      },
      {
        id: 'item-blade',
        type: 'BLADE',
        power: 30,
        state: 'AVAILABLE',
        sourceTaskId: 'habit-brush',
      },
      {
        id: 'item-crystal',
        type: 'CRYSTAL',
        power: 20,
        state: 'AVAILABLE',
        sourceTaskId: 'daily-reading',
      },
    ]
    store.$patch({
      backendEnabled: false,
      game: { ...store.game, enemyName: '洞窟のゴブリン', enemyHp: 380, enemyMaxHp: 700, inventory },
    })

    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.get('.battle-enemy img').attributes()).toMatchObject({
      src: '/assets/enemy-purple-ogre.png',
      alt: '',
    })
    expect(wrapper.get('.item-icon[data-type="SPARK"] img').attributes('src')).toBe('/assets/item-spark.png')
    expect(wrapper.get('.item-icon[data-type="BLADE"] img').attributes('src')).toBe('/assets/item-blade.png')
    expect(wrapper.get('.item-icon[data-type="CRYSTAL"] img').attributes('src')).toBe('/assets/item-crystal.png')
    expect(wrapper.text()).not.toContain('🧌')
    expect(wrapper.text()).not.toContain('✦')
    expect(wrapper.text()).not.toContain('◆')
    expect(wrapper.get('.item-icon[data-type="BLADE"]').text()).toBe('')
  })

  it.each([
    { currentHp: -24, maxHp: 100, expectedWidth: '0%', expectedNow: '0', expectedValueText: '0 / 100' },
    { currentHp: 240, maxHp: 100, expectedWidth: '100%', expectedNow: '100', expectedValueText: '100 / 100' },
  ])('HPを範囲内に収めてアクセシブルな進捗として表示する', ({ currentHp, maxHp, expectedWidth, expectedNow, expectedValueText }) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.$patch({
      backendEnabled: false,
      game: { ...store.game, enemyHp: currentHp, enemyMaxHp: maxHp },
    })

    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    const progress = wrapper.get('[role="progressbar"]')

    expect(progress.attributes()).toMatchObject({
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': expectedNow,
      'aria-valuetext': expectedValueText,
    })
    expect(wrapper.get('.hp-bar--large span').attributes('style')).toContain(`width: ${expectedWidth}`)
  })

  it.each([
    { currentHp: 100, expectedState: 'healthy', label: '警戒中' },
    { currentHp: 50, expectedState: 'wounded', label: '弱っている' },
    { currentHp: 25, expectedState: 'critical', label: 'あと一息' },
    { currentHp: 0, expectedState: 'defeated', label: '撃破' },
  ])('HP状態をdata属性と可視ラベルで表示する', ({ currentHp, expectedState, label }) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.$patch({ backendEnabled: false, game: { ...store.game, enemyHp: currentHp, enemyMaxHp: 100 } })

    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.get('.battle-arena').attributes('data-enemy-state')).toBe(expectedState)
    expect(wrapper.text()).toContain(label)
  })

  it.each([
    [0, '1.00'],
    [3, '1.10'],
    [7, '1.25'],
    [14, '1.50'],
  ])('連続達成倍率をheaderと攻撃詳細に一貫して表示する', (streakDays, multiplier) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.$patch({ backendEnabled: false, game: { ...store.game, streakDays } })

    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.get('.player-level small').text()).toBe(`連続${streakDays}日 · ×${multiplier}`)
    expect(wrapper.get('.attack-panel dl div:nth-child(2) dd').text()).toBe(`×${multiplier}`)
  })

  it('敵名をarenaのラベルとHPのaria-labelに動的に反映する', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.$patch({ backendEnabled: false, game: { ...store.game, enemyName: '紫晶のオーガ' } })

    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.get('.battle-arena').attributes('aria-labelledby')).toBe('battle-enemy-name')
    expect(wrapper.get('#battle-enemy-name').text()).toBe('紫晶のオーガ')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('紫晶のオーガHP')
  })

  it('空の敵名と未知のアイテム種別を表示時にも安全にフォールバックする', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    const unknownItem = {
      id: 'unknown-item',
      type: 'UNKNOWN',
      power: 10,
      state: 'AVAILABLE',
      sourceTaskId: 'task-1',
    } as unknown as InventoryItem
    store.$patch({
      backendEnabled: false,
      game: { ...store.game, enemyName: '   ', inventory: [unknownItem] },
    })

    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.get('#battle-enemy-name').text()).toBe('紫の守護者')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('紫の守護者HP')
    expect(wrapper.get('.item-icon img').attributes('src')).toBe('/assets/item-crystal.png')
  })

  it('攻撃中のダメージ演出を表示し、終了後に解除する', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useQuestStore(pinia)
    store.enterDemoMode()
    const wrapper = mount(BattleView, {
      global: { plugins: [pinia], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })

    await wrapper.get('.button--attack').trigger('click')
    await flushPromises()

    expect(wrapper.get('.battle-arena').classes()).toContain('battle-arena--hit')
    expect(wrapper.get('.damage-number').attributes('aria-label')).toMatch(/^\d+ダメージ$/)

    vi.advanceTimersByTime(700)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.battle-arena').classes()).not.toContain('battle-arena--hit')

    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.damage-number').exists()).toBe(false)
  })
})
