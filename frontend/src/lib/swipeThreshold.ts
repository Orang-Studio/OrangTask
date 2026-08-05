export const TASK_SWIPE_THRESHOLD_RATIO = 0.5

export function crossesTaskSwipeThreshold(offsetX: number, rowWidth: number): boolean {
  return rowWidth > 0 && Math.abs(offsetX) >= rowWidth * TASK_SWIPE_THRESHOLD_RATIO
}
