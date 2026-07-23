import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskCard from './TaskCard.vue'
import type { QuestTask } from '@/domain/types'

const task: QuestTask = {
  id: 'task-1',
  title: 'レポートを書く',
  taskType: 'DAILY',
  category: 'PC_WORK',
  status: 'TODO',
  estimatedMinutes: 45,
  weight: 3,
  requiredPlace: 'PC',
  scheduledWindow: 'DAYTIME',
}

describe('TaskCard', () => {
  it('未着手タスクではQR開始イベントを送る', async () => {
    const wrapper = mount(TaskCard, { props: { task } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('start')).toEqual([['task-1']])
    expect(wrapper.text()).toContain('PC前')
  })

  it('着手済みタスクでは完了イベントを送る', async () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: { ...task, status: 'STARTED' },
      },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('complete')).toEqual([['task-1']])
  })

  it('完了済みタスクには操作ボタンを表示しない', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: { ...task, status: 'DONE' },
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('完了')
  })
})
