import type {
  ForecastSummary,
  PlanDraft,
  ProgressSummary,
  QuestTask,
  RiskLevel,
} from './types'

export function calculateProgress(tasks: QuestTask[]): ProgressSummary {
  const doneTasks = tasks.filter((task) => task.status === 'DONE')
  const doneWeight = doneTasks.reduce((total, task) => total + task.weight, 0)
  const totalWeight = tasks.reduce((total, task) => total + task.weight, 0)

  return {
    completedCount: doneTasks.length,
    totalCount: tasks.length,
    doneWeight,
    totalWeight,
    percentage: totalWeight === 0 ? 0 : Math.round((doneWeight / totalWeight) * 100),
  }
}

export function forecastDay(tasks: QuestTask[], minutesUntilSleep: number): ForecastSummary {
  const remainingMinutes = Math.round(
    tasks.reduce((total, task) => {
      if (task.status === 'TODO') return total + task.estimatedMinutes
      if (task.status === 'STARTED') return total + task.estimatedMinutes * 0.6
      return total
    }, 0),
  )
  const effectiveAvailableMinutes = Math.max(1, minutesUntilSleep - 30)
  const utilization = remainingMinutes / effectiveAvailableMinutes
  const riskLevel: RiskLevel =
    utilization <= 0.7 ? 'LOW' : utilization <= 1 ? 'MEDIUM' : 'HIGH'

  return {
    remainingMinutes,
    effectiveAvailableMinutes,
    utilization,
    riskLevel,
  }
}

export function minutesUntilClock(clock: string, now = new Date()): number {
  const values = clock.split(':').map((value) => Number(value))
  const hours = values[0] ?? Number.NaN
  const minutes = values[1] ?? Number.NaN
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0

  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)

  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000)
  return Math.max(0, diffMinutes)
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60

  if (hours <= 0) return `${mins}分`
  if (mins === 0) return `${hours}時間`
  return `${hours}時間${mins}分`
}

export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 14) return 1.5
  if (streakDays >= 7) return 1.25
  if (streakDays >= 3) return 1.1
  return 1
}

export function estimateBattleDamage(
  itemPowers: number[],
  streakDays: number,
  completionPercentage: number,
): number {
  const baseDamage = itemPowers.reduce((total, power) => total + power, 0)
  const quotaMultiplier = completionPercentage === 100 ? 1.2 : 1
  return Math.floor(baseDamage * streakMultiplier(streakDays) * quotaMultiplier)
}

export function validatePlanDraft(draft: PlanDraft): string[] {
  const errors: string[] = []
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

  if (!timePattern.test(draft.wakeTime) || !timePattern.test(draft.sleepTime)) {
    errors.push('時刻を正しく入力してください')
  } else if (draft.wakeTime === draft.sleepTime) {
    errors.push('就寝時刻と起床時刻は別の時刻にしてください')
  }

  if (draft.taskTitles.some((title) => title.trim().length === 0)) {
    errors.push('タスク名を入力してください')
  }

  return errors
}
