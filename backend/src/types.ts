export interface AppUser {
  id: string
  email: string
  name: string
  avatar_url?: string | null
  is_guest?: boolean
}

export type AppVariables = {
  userId: string
  user: AppUser
}
export type AppEnv = { Variables: AppVariables }