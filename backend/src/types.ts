// shared Hono context variable types so c.get('userId') / c.get('user') are typed
export interface AppUser {
  id: string
  email: string
  name: string
  avatar_url?: string | null
}

export type AppVariables = {
  userId: string
  user: AppUser
}

export type AppEnv = { Variables: AppVariables }
