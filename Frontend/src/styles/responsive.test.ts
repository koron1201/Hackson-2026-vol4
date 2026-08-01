import { describe, expect, it, vi } from 'vitest'

const { readFileSync } = await vi.importActual<{
  readFileSync(path: string, encoding: 'utf8'): string
}>('node:fs')
const { resolve } = await vi.importActual<{
  resolve(...paths: string[]): string
}>('node:path')
const workingDirectory = (
  globalThis as typeof globalThis & { process: { cwd(): string } }
).process.cwd()
const css = readFileSync(resolve(workingDirectory, 'src/styles/main.css'), 'utf8').replace(/\r\n/g, '\n')
const html = readFileSync(resolve(workingDirectory, 'index.html'), 'utf8')

function rule(selector: string): string {
  const normalizedSelector = selector.replace(/\s+/g, ' ').trim()
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1]?.replace(/\s+/g, ' ').trim() === normalizedSelector) return match[2] ?? ''
  }
  return ''
}

describe('mobile responsive CSS contract', () => {
  it('主要モバイル幅と横向きカメラ用の境界を定義する', () => {
    expect(html).toContain('width=device-width, initial-scale=1.0, viewport-fit=cover')
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('@media (max-width: 360px)')
    expect(css).toContain('@media (orientation: landscape) and (max-height: 560px)')
  })

  it('共通クロームを四辺のSafe Areaへ追従させる', () => {
    expect(rule(':root')).toContain('--safe-top: env(safe-area-inset-top, 0px)')
    expect(rule(':root')).toContain('--safe-right: env(safe-area-inset-right, 0px)')
    expect(rule(':root')).toContain('--safe-left: env(safe-area-inset-left, 0px)')
    expect(rule('.app-header')).toContain('var(--safe-top)')
    expect(rule('.bottom-nav')).toContain('bottom: var(--safe-bottom)')
    expect(rule('.bottom-nav')).toContain('var(--safe-left)')
    expect(rule('.bottom-nav')).toContain('var(--safe-right)')
    expect(rule('.app-main')).toContain('var(--safe-bottom)')
    expect(rule('.floating-add')).toContain('var(--safe-bottom)')
  })

  it('動的viewport高と狭幅フォームの縮小を保証する', () => {
    expect(css.match(/min-height:\s*100dvh/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
    expect(rule('input,\nselect')).toContain('min-width: 0')
    expect(rule('.plan-task-row > div')).toContain('min-width: 0')
  })
})
