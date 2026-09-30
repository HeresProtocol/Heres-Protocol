/**
 * Retry only explicit RPC authentication rejection, not ambiguous transaction/network failures.
 *
 * Once the primary endpoint has rejected our key, it will keep rejecting it, so every later request
 * goes straight to the fallback instead of paying a failed round trip (~1s) first. Without this,
 * each page load and each step of capsule creation was roughly 4x slower than it needs to be.
 */
export function rpcFetchWithAuthFallback(fallbackUrl: string, fetcher: typeof fetch = fetch): typeof fetch {
  let primaryRejected = false
  return async (input, init) => {
    const source = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (primaryRejected && source !== fallbackUrl) return fetcher(fallbackUrl, init)
    const response = await fetcher(input, init)
    if (response.status !== 401 && response.status !== 403) return response
    if (source === fallbackUrl) return response
    primaryRejected = true
    return fetcher(fallbackUrl, init)
  }
}
