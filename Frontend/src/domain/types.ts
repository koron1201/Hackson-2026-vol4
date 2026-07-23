export type TaskStatus = 'TODO' | 'STARTED' | 'DONE' | 'SKIPPED'
export type TaskType = 'HABIT' | 'DAILY'
export type PlaceType = 'WASHROOM' | 'PC' | 'ENTRANCE' | 'NONE'
export type TaskCategory = 'HYGIENE' | 'MEAL' | 'PC_WORK' | 'OUTING' | 'EXERCISE' | 'OTHER'
export type ScheduledWindow = 'MORNING' | 'DAYTIME' | 'EVENING' | 'ANY'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ItemType = 'SPARK' | 'BLADE' | 'CRYSTAL'
export type ItemState = 'PENDING' | 'AVAILABLE' | 'CONSUMED'

export interface QuestTask {
  id: string
  title: string
  taskType: TaskType
  category: TaskCategory
  status: TaskStatus
  estimatedMinutes: number
  weight: number
  requiredPlace: PlaceType
  scheduledWindow: ScheduledWindow
}

export interface PlanDraft {
  wakeTime: string
  sleepTime: string
  taskTitles: string[]
}

export interface ProgressSummary {
  completedCount: number
  totalCount: number
  doneWeight: number
  totalWeight: number
  percentage: number
}

export interface ForecastSummary {
  remainingMinutes: number
  effectiveAvailableMinutes: number
  utilization: number
  riskLevel: RiskLevel
}

export interface InventoryItem {
  id: string
  type: ItemType
  power: number
  state: ItemState
  sourceTaskId: string
}

export interface GameState {
  level: number
  xp: number
  streakDays: number
  enemyName: string
  enemyHp: number
  enemyMaxHp: number
  inventory: InventoryItem[]
}

export interface DailyPlan {
  localDate: string
  wakeTime: string
  sleepTime: string
  version: number
  tasks: QuestTask[]
}
