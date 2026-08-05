import { describe, expect, it } from 'vitest'
import { crossesTaskSwipeThreshold, TASK_SWIPE_THRESHOLD_RATIO } from './swipeThreshold'

describe('task swipe threshold', () => {
  it('requires half of the task row width before an action can fire', () => {
    expect(TASK_SWIPE_THRESHOLD_RATIO).toBe(0.5)
    expect(crossesTaskSwipeThreshold(174, 350)).toBe(false)
    expect(crossesTaskSwipeThreshold(175, 350)).toBe(true)
  })

  it('uses absolute distance so either direction has the same cancellation margin', () => {
    expect(crossesTaskSwipeThreshold(-174, 350)).toBe(false)
    expect(crossesTaskSwipeThreshold(-175, 350)).toBe(true)
  })
})
