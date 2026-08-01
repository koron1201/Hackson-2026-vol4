import { describe, expect, it } from 'vitest'
import {
  calculateProgress,
  estimateBattleDamage,
  forecastDay,
  phaseFromHour,
  validatePlanDraft,
} from './quest'
import type { QuestTask } from './types'

const tasks: QuestTask[] = [
  {
    id: 'task-1',
    title: '歯を磨く',
    taskType: 'HABIT',
    category: 'HYGIENE',
    status: 'DONE',
    estimatedMinutes: 5,
    weight: 1,
    requiredPlace: 'WASHROOM',
    scheduledWindow: 'MORNING',
  },
  {
    id: 'task-2',
    title: 'レポートを書く',
    taskType: 'DAILY',
    category: 'PC_WORK',
    status: 'STARTED',
    estimatedMinutes: 60,
    weight: 4,
    requiredPlace: 'PC',
    scheduledWindow: 'DAYTIME',
  },
  {
    id: 'task-3',
    title: '散歩する',
    taskType: 'DAILY',
    category: 'EXERCISE',
    status: 'TODO',
    estimatedMinutes: 30,
    weight: 2,
    requiredPlace: 'ENTRANCE',
    scheduledWindow: 'DAYTIME',
  },
]

describe('calculateProgress', () => {
  it('重みを基準に達成率を計算する', () => {
    expect(calculateProgress(tasks)).toEqual({
      completedCount: 1,
      totalCount: 3,
      doneWeight: 1,
      totalWeight: 7,
      percentage: 14,
    })
  })

  it('タスクが空でも0として扱う', () => {
    expect(calculateProgress([]).percentage).toBe(0)
  })
})

describe('forecastDay', () => {
  it('着手済みは見積の60%として残り時間を計算する', () => {
    const result = forecastDay(tasks, 150)

    expect(result.remainingMinutes).toBe(66)
    expect(result.effectiveAvailableMinutes).toBe(120)
    expect(result.riskLevel).toBe('LOW')
  })

  it('就寝準備時間を除くと予定超過する場合はHIGHを返す', () => {
    expect(forecastDay(tasks, 60).riskLevel).toBe('HIGH')
  })

  it('利用率が70%を超え100%以下ならMEDIUMを返す', () => {
    expect(forecastDay(tasks, 110).riskLevel).toBe('MEDIUM')
  })
})

describe('phaseFromHour', () => {
  it.each([
    [0, 'morning'],
    [8, 'morning'],
    [9, 'daytime'],
    [19, 'daytime'],
    [20, 'night'],
    [23, 'night'],
  ])('時刻%d時を%sフェーズに分類する', (hour, expected) => {
    expect(phaseFromHour(hour)).toBe(expected)
  })

  it('24時を朝として扱う', () => {
    expect(phaseFromHour(24)).toBe('morning')
  })
})

describe('estimateBattleDamage', () => {
  it('連続日数と100%達成倍率を適用する', () => {
    expect(estimateBattleDamage([15, 30], 7, 100)).toBe(67)
  })

  it('アイテム未選択時は0を返す', () => {
    expect(estimateBattleDamage([], 14, 100)).toBe(0)
  })

  it.each([
    [0, 15],
    [3, 16],
    [7, 18],
    [14, 22],
  ])('連続%d日の倍率を適用する', (days, expected) => {
    expect(estimateBattleDamage([15], days, 80)).toBe(expected)
  })
})

describe('validatePlanDraft', () => {
  it('空のタスク名と同一時刻を拒否する', () => {
    const errors = validatePlanDraft({
      wakeTime: '07:00',
      sleepTime: '07:00',
      taskTitles: ['歯磨き', '  '],
    })

    expect(errors).toContain('就寝時刻と起床時刻は別の時刻にしてください')
    expect(errors).toContain('タスク名を入力してください')
  })

  it('有効な入力ではエラーを返さない', () => {
    expect(
      validatePlanDraft({
        wakeTime: '07:00',
        sleepTime: '23:30',
        taskTitles: ['歯磨き'],
      }),
    ).toEqual([])
  })

  it('不正な時刻形式を拒否する', () => {
    expect(
      validatePlanDraft({
        wakeTime: '25:00',
        sleepTime: 'night',
        taskTitles: ['読書'],
      }),
    ).toContain('時刻を正しく入力してください')
  })
})
