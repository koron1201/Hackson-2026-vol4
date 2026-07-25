export interface BackendTask {
  id: number
  user_id: number
  title: string
  category: string | null
  estimated_minutes: number
  is_completed: boolean
  recommended_qr: string | null
}

export interface CreateBackendTaskInput {
  user_id: number
  title: string
  category: string
  estimated_minutes: number
  is_completed: boolean
  recommended_qr: string | null
}

export interface TaskCompletionResponse {
  message: string
  earned_coins: number
  total_coins: number
}

export interface QrVerificationResponse {
  success: boolean
  message: string
}

export interface TaskAnalysisResponse {
  category: string
  estimated_minutes: number
  recommended_qr: string
  note?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'INTERNAL_ERROR',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate.replace(/\/+$/, '')
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('有効なバックエンド接続先を指定してください。')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('HTTPまたはHTTPSの接続先を指定してください。')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('接続先には認証情報、クエリ、フラグメントを含めないでください。')
  }

  return url.toString().replace(/\/+$/, '')
}

function errorForStatus(status: number): ApiError {
  if (status === 400 || status === 422) {
    return new ApiError('入力内容を確認してください。', status, 'VALIDATION_ERROR')
  }
  if (status === 404) {
    return new ApiError('対象のデータが見つかりません。', status, 'NOT_FOUND')
  }
  if (status >= 500) {
    return new ApiError(
      'バックエンドで問題が発生しました。時間をおいて再試行してください。',
      status,
      'SERVER_ERROR',
    )
  }
  return new ApiError('通信に失敗しました。もう一度お試しください。', status)
}

export function createApiClient(
  configuredBaseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  const baseUrl = normalizeBaseUrl(configuredBaseUrl)

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!baseUrl) {
      throw new ApiError('バックエンド接続先が設定されていません。', 0, 'NOT_CONFIGURED')
    }

    const headers = new Headers(init.headers)
    if (init.body !== undefined) headers.set('Content-Type', 'application/json')

    let response: Response
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        ...init,
        headers,
        credentials: 'omit',
      })
    } catch {
      throw new ApiError(
        'バックエンドへ接続できません。起動状態と接続先を確認してください。',
        0,
        'NETWORK_ERROR',
      )
    }

    if (!response.ok) throw errorForStatus(response.status)
    if (response.status === 204) return undefined as T

    try {
      return (await response.json()) as T
    } catch {
      throw new ApiError('バックエンドから不正な応答を受信しました。', response.status, 'INVALID_RESPONSE')
    }
  }

  return {
    health: () => request<{ message: string }>('/'),
    createTask: (task: CreateBackendTaskInput) =>
      request<BackendTask>('/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      }),
    completeTask: (taskId: number) =>
      request<TaskCompletionResponse>(`/game/tasks/${taskId}/complete`, {
        method: 'POST',
      }),
    verifyQr: (scannedQrCode: string, targetQrCode: string) =>
      request<QrVerificationResponse>('/qr/verify', {
        method: 'POST',
        body: JSON.stringify({
          scanned_qr_code: scannedQrCode,
          target_qr_code: targetQrCode,
        }),
      }),
    analyzeTask: (taskTitle: string) =>
      request<TaskAnalysisResponse>('/ai/analyze-task', {
        method: 'POST',
        body: JSON.stringify({ task_title: taskTitle }),
      }),
  }
}

export const isBackendConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim())
export const apiClient = createApiClient(import.meta.env.VITE_API_BASE_URL)
