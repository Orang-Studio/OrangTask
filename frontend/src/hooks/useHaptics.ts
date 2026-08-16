export const useHaptics = () => {
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }
  return {
    tap: () => vibrate(10),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([50, 30, 50]),
    swipe: () => vibrate(20),
    drag: () => vibrate(5),
  }
}