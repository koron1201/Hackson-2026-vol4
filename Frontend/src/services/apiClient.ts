import type { DailyPlan, GameState, QuestTask } from '../domain/types'

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    requestId?: string
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'INTERNAL_ERROR',
    public readonly requestId?: string,
  ) {
    super(message)
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/v1'
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(
      body.error?.message ?? '通信に失敗しました。もう一度お試しください。',
      response.status,
      body.error?.code,
      body.error?.requestId,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiClient = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: number; name: string; email: string | null } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ accessToken: string; user: { id: number; name: string; email: string | null } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  getHome: (localDate: string) =>
    request<{ phase: string; tasks: QuestTask[] }>(`/home?localDate=${localDate}`),
  getPlan: (localDate: string) => request<DailyPlan>(`/plans/${localDate}`),
  savePlan: (plan: DailyPlan) =>
    request<DailyPlan>(`/plans/${plan.localDate}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),
  updateTaskStatus: (
    taskId: string,
    status: QuestTask['status'],
    version: number,
    extras?: Record<string, unknown>,
  ) =>
    request<QuestTask>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, version, clientEventId: crypto.randomUUID(), ...(extras ?? {}) }),
    }),
  createTask: (task: Partial<QuestTask>) =>
    request<QuestTask>('/tasks', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(task),
    }),
  deleteTask: (taskId: string) =>
    request<void>(`/tasks/${taskId}`, {
      method: 'DELETE',
    }),
  verifyScan: (rawToken: string, taskId: string, purpose: 'TASK_START' | 'ALARM_DISMISS') =>
    request<{ verified: boolean; task: QuestTask }>('/scans/verify', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        rawToken,
        taskId,
        purpose,
        scannedAt: new Date().toISOString(),
        clientEventId: crypto.randomUUID(),
      }),
    }),
  getGameState: () => request<GameState>('/game-state'),
  battle: (itemIds: string[], clientEventId: string) =>
    request<{ damage: number; enemyHp: number }>('/battles', {
      method: 'POST',
      headers: { 'Idempotency-Key': clientEventId },
      body: JSON.stringify({ itemIds, clientEventId }),
    }),
}
