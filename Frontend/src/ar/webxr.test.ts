import { describe, expect, it } from 'vitest'
import { supportsImmersiveAr, type WebXRNavigator } from './webxr'

describe('supportsImmersiveAr', () => {
  it('returns false when WebXR is not exposed', async () => {
    expect(await supportsImmersiveAr({} as WebXRNavigator)).toBe(false)
  })

  it('uses the browser capability check', async () => {
    const navigatorLike = {
      xr: {
        isSessionSupported: async (mode: string) => mode === 'immersive-ar',
      },
    } as WebXRNavigator

    expect(await supportsImmersiveAr(navigatorLike)).toBe(true)
  })
})
