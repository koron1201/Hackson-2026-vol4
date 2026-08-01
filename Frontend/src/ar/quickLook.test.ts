import { describe, expect, it } from 'vitest'
import { supportsQuickLookAr, type QuickLookNavigator } from './quickLook'

describe('supportsQuickLookAr', () => {
  it('recognizes iPhone Safari as a Quick Look target', () => {
    expect(
      supportsQuickLookAr({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      } as QuickLookNavigator),
    ).toBe(true)
  })

  it('recognizes iPadOS devices that identify as MacIntel', () => {
    expect(
      supportsQuickLookAr({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      } as QuickLookNavigator),
    ).toBe(true)
  })

  it('does not offer Quick Look on desktop and Android browsers', () => {
    expect(
      supportsQuickLookAr({
        userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0',
        platform: 'Linux armv81',
        maxTouchPoints: 5,
      } as QuickLookNavigator),
    ).toBe(false)
  })
})
