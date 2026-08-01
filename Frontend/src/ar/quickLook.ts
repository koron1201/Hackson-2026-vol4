export type QuickLookNavigator = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>

/**
 * AR Quick Look is the native AR viewer available on iPhone and iPad.
 * iPadOS can report itself as a Mac, so touch points are also checked.
 */
export function supportsQuickLookAr(
  navigatorLike: QuickLookNavigator = navigator,
): boolean {
  const isIphoneOrIpad = /iPhone|iPad|iPod/i.test(navigatorLike.userAgent)
  const isIpadOsDesktopUserAgent =
    navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1

  return isIphoneOrIpad || isIpadOsDesktopUserAgent
}
