export const DELETE_UNDO_DELAY_MS = 5000

export function scheduleDelete(callback: () => void) {
  return setTimeout(callback, DELETE_UNDO_DELAY_MS)
}
