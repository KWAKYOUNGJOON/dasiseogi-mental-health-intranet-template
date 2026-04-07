export default function setupVitestWorkerTimeout() {
  const originalSetTimeout = globalThis.setTimeout

  globalThis.setTimeout = ((handler, timeout, ...args) =>
    originalSetTimeout(
      handler,
      typeof timeout === 'number' && timeout >= 60_000 ? timeout * 3 : timeout,
      ...args,
    )) as typeof setTimeout

  return () => {
    globalThis.setTimeout = originalSetTimeout
  }
}
