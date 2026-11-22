// native clients identify via x platform header or platform query param
export const NATIVE_PLATFORMS = ['android', 'desktop'] as const
export type NativePlatform = typeof NATIVE_PLATFORMS[number]

export function nativePlatform(value?: string | null): NativePlatform | null {
  return NATIVE_PLATFORMS.find((p) => p === value) ?? null
}
