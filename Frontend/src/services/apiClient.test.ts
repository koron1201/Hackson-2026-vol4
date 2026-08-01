import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, setAccessToken } from './apiClient'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('backend API client', () => {
  it('バックエンドのルートで接続状態を確認する', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ message: 'MorningQuest API is running!' }),
    )
    const client = createApiClient('http://localhost:8000/', fetcher)

    await expect(client.health()).resolves.toEqual({
      message: 'MorningQuest API is running!',
    })
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8000/',
      expect.objectContaining({ credentials: 'omit' }),
    )
  })

  it('メモリ上のaccess tokenで現在の利用者を検証する', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ id: 1, name: 'ゆうき', email: 'you@example.com' }),
    )
    const client = createApiClient('http://localhost:8000', fetcher)
    setAccessToken('test-access-token')

    try {
      await expect(client.me()).resolves.toEqual({
        id: 1,
        name: 'ゆうき',
        email: 'you@example.com',
      })
      const request = fetcher.mock.calls[0]?.[1]
      expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8000/auth/me')
      expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer test-access-token')
    } finally {
      setAccessToken(null)
    }
  })

  it('バックエンド形式でタスクを作成する', async () => {
    const createdTask = {
      id: 12,
      user_id: 1,
      title: '資料を作る',
      category: 'PC_WORK',
      estimated_minutes: 45,
      is_completed: false,
      recommended_qr: 'DESK',
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(createdTask))
    const client = createApiClient('http://localhost:8000', fetcher)

    await expect(
      client.createTask({
        user_id: 1,
        title: '資料を作る',
        category: 'PC_WORK',
        estimated_minutes: 45,
        is_completed: false,
        recommended_qr: 'DESK',
      }),
    ).resolves.toEqual(createdTask)
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8000/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          user_id: 1,
          title: '資料を作る',
          category: 'PC_WORK',
          estimated_minutes: 45,
          is_completed: false,
          recommended_qr: 'DESK',
        }),
      }),
    )
  })

  it('タスク完了、QR照合、AI分析を現行エンドポイントへ送る', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Task completed!', earned_coins: 10, total_coins: 30 }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'QRコード一致！' }))
      .mockResolvedValueOnce(
        jsonResponse({
          category: 'PC_WORK',
          estimated_minutes: 30,
          recommended_qr: 'DESK',
        }),
      )
    const client = createApiClient('http://localhost:8000', fetcher)

    await expect(client.completeTask(12)).resolves.toMatchObject({ total_coins: 30 })
    await expect(client.verifyQr('DESK', 'DESK')).resolves.toMatchObject({ success: true })
    await expect(client.analyzeTask('資料を作る')).resolves.toMatchObject({
      recommended_qr: 'DESK',
    })

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8000/game/tasks/12/complete',
      'http://localhost:8000/qr/verify',
      'http://localhost:8000/ai/analyze-task',
    ])
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ scanned_qr_code: 'DESK', target_qr_code: 'DESK' }),
    )
  })

  it('FastAPIの検証エラーを内部詳細を露出しないエラーへ変換する', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          detail: [
            {
              type: 'int_parsing',
              loc: ['body', 'user_id'],
              msg: 'Input should be a valid integer',
            },
          ],
        },
        { status: 422 },
      ),
    )
    const client = createApiClient('http://localhost:8000', fetcher)

    await expect(client.completeTask(12)).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: '入力内容を確認してください。',
    } satisfies Partial<ApiError>)
  })

  it('未設定またはHTTP以外の接続先を拒否する', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const unconfiguredClient = createApiClient('', fetcher)

    await expect(unconfiguredClient.health()).rejects.toThrow(
      'バックエンド接続先が設定されていません。',
    )
    expect(() => createApiClient('file:///tmp/api', fetcher)).toThrow(
      'HTTPまたはHTTPSの接続先を指定してください。',
    )
    expect(() => createApiClient('https://user:secret@example.com/api', fetcher)).toThrow(
      '接続先には認証情報、クエリ、フラグメントを含めないでください。',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
})
