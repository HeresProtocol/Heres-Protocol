/**
 * Retry only explicit RPC rejection (bad key, or an exhausted usage plan), not ambiguous
 * transaction/network failures.
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
    if (source === fallbackUrl) return response
    // An exhausted plan ("429 ... max usage reached") is as permanent as a rejected key; a plain 429
    // is a temporary rate limit and is left to the caller's normal retry.
    const quotaExhausted = response.status === 429 &&
      /max usage|quota|credits|limit exceeded|upgrade/i.test(await response.clone().text().catch(() => ''))
    if (response.status !== 401 && response.status !== 403 && !quotaExhausted) return response
    primaryRejected = true
    return fetcher(fallbackUrl, init)
  }
}
