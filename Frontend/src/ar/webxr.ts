export type WebXRNavigator = Navigator & {
  xr?: XRSystem
}

/** Returns false for browsers that do not expose WebXR or immersive AR. */
export async function supportsImmersiveAr(
  navigatorLike: WebXRNavigator = navigator as WebXRNavigator,
): Promise<boolean> {
  const xr = navigatorLike.xr
  if (!xr) return false

  try {
    return await xr.isSessionSupported('immersive-ar')
  } catch {
    return false
  }
}
