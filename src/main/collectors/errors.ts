export function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** macOS denies reading another app's Application Support without Full Disk Access. */
export function isPermissionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'EPERM' || code === 'EACCES'
}
