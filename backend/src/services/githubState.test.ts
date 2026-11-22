import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createNativeGithubState,
  isNativeGithubState,
  nativeGithubStateUserId,
} from './githubState.js'

describe('native GitHub integration state', () => {
  const previousSecret = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = 'github-state-test-secret'
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = previousSecret
  })

  test('round-trips the authenticated Android user', () => {
    const now = 1_700_000_000_000
    const state = createNativeGithubState('user-123', now)

    expect(isNativeGithubState(state)).toBe(true)
    expect(nativeGithubStateUserId(state, now + 1_000)).toBe('user-123')
  })

  test('rejects expired and tampered states', () => {
    const now = 1_700_000_000_000
    const state = createNativeGithubState('user-123', now)
    const tampered = `${state.slice(0, -1)}${state.endsWith('a') ? 'b' : 'a'}`

    expect(nativeGithubStateUserId(state, now + 10 * 60 * 1_000 + 1)).toBeNull()
    expect(nativeGithubStateUserId(tampered, now + 1_000)).toBeNull()
  })
})
