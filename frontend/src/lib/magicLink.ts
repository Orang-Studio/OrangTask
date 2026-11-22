export type MagicLinkAction =
  | { kind: 'invalid' }
  | { kind: 'browser'; token: string; verifyUrl: string }
  | { kind: 'app'; token: string; appUrl: string }

export function resolveMagicLink(searchParams: URLSearchParams): MagicLinkAction {
  const token = searchParams.get('token') ?? ''
  if (!token) return { kind: 'invalid' }

  const encodedToken = new URLSearchParams({ token }).toString()
  // requested by a native client android desktop hand the token to the app
  if (searchParams.get('platform')) {
    return { kind: 'app', token, appUrl: `orangtask://magic-link?${encodedToken}` }
  }

  return { kind: 'browser', token, verifyUrl: `/api/auth/magic-link/verify?${encodedToken}` }
}
