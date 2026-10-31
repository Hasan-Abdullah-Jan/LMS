/** Current server time. Centralised so tests can control the clock with vi.useFakeTimers(). */
export function now(): Date {
  return new Date();
}
