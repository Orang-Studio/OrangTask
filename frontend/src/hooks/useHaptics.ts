// wraps navigator.vibrate() - only fires on devices that support it (mobile), silently no-ops on
export const useHaptics = () => {
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  return {
    tap: () => vibrate(10), // light tap - button press
    success: () => vibrate([10, 50, 10]), // task complete
    error: () => vibrate([50, 30, 50]), // error
    swipe: () => vibrate(20), // swipe action
    drag: () => vibrate(5), // drag start
  }
}
