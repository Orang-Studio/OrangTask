import { afterEach, describe, expect, it, vi } from 'vitest'
import { DELETE_UNDO_DELAY_MS, scheduleDelete } from './undoableDelete'

describe('scheduleDelete', () => {
  afterEach(() => vi.useRealTimers())

  it('waits the full undo window before deleting', () => {
    vi.useFakeTimers()
    const deleteTask = vi.fn()

    scheduleDelete(deleteTask)
    vi.advanceTimersByTime(DELETE_UNDO_DELAY_MS - 1)
    expect(deleteTask).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(deleteTask).toHaveBeenCalledOnce()
  })

  it('can be cancelled when the user chooses undo', () => {
    vi.useFakeTimers()
    const deleteTask = vi.fn()

    const timer = scheduleDelete(deleteTask)
    clearTimeout(timer)
    vi.advanceTimersByTime(DELETE_UNDO_DELAY_MS)

    expect(deleteTask).not.toHaveBeenCalled()
  })
})
