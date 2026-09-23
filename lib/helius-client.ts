export type HeliusNetwork = 'devnet' | 'testnet' | 'mainnet-beta'

const HELIUS_PLACEHOLDER_RE = /^(?:your[_-]?helius[_-]?api[_-]?key|your[_-]?api[_-]?key|replace[_-]?me|changeme)$/i

export function isValidHeliusApiKey(value: string | undefined | null): value is string {
  const key = value?.trim()
  return Boolean(key && !HELIUS_PLACEHOLDER_RE.test(key))
}

export function getDefaultHeliusRpcUrl(network: HeliusNetwork, apiKey: string): string {
  const subdomain = network === 'mainnet-beta' ? 'mainnet' : network
  const url = new URL(`https://${subdomain}.helius-rpc.com/`)
  url.searchParams.set('api-key', apiKey.trim())
  return url.toString()
}

export function getDefaultHeliusApiBaseUrl(): string {
  return 'https://api.helius.xyz/v0'
}

export function getDefaultSolanaRpcUrl(network: HeliusNetwork): string {
  switch (network) {
    case 'mainnet-beta':
      return 'https://api.mainnet-beta.solana.com'
    case 'testnet':
      return 'https://api.testnet.solana.com'
    case 'devnet':
    default:
      return 'https://api.devnet.solana.com'
  }
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000)

  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - now)
}

export class HeliusHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Helius request failed (${status})`)
    this.name = 'HeliusHttpError'
    this.status = status
  }
}

type HeliusFetchOptions = {
  maxRetries?: number
  maxRetryDelayMs?: number
  fetchImpl?: typeof fetch
  sleep?: (delayMs: number) => Promise<void>
}

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs))

/** Retry Helius throttling/transient failures without ever logging the API-key-bearing URL. */
export async function fetchHeliusJson<T>(
  input: string | URL,
  init: RequestInit = {},
  options: HeliusFetchOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 5_000
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep

  for (let attempt = 0; ; attempt += 1) {
    let response: Response
    try {
      response = await fetchImpl(input, init)
    } catch (error) {
      if (attempt >= maxRetries) throw error
      await sleep(Math.min(1_000 * 2 ** attempt, maxRetryDelayMs))
      continue
    }

    if (response.ok) return await response.json() as T

    const retryable = response.status === 429 || response.status === 503 || response.status >= 500
    if (!retryable || attempt >= maxRetries) throw new HeliusHttpError(response.status)

    const retryAfter = parseRetryAfterMs(response.headers.get('retry-after'))
    const delayMs = retryAfter ?? 1_000 * 2 ** attempt
    await sleep(Math.min(delayMs, maxRetryDelayMs))
  }
}

export type HeliusActivity = {
  wallet: string
  lastSignature: string
  lastActivityTimestamp: number
  transactionCount: number
}

export function activityFromTransactions(wallet: string, transactions: any[]): HeliusActivity {
  const ordered = [...transactions].sort((a, b) => {
    const timeA = Number(a?.timestamp ?? a?.blockTime ?? a?.tx?.blockTime ?? 0)
    const timeB = Number(b?.timestamp ?? b?.blockTime ?? b?.tx?.blockTime ?? 0)
    return timeB - timeA
  })
  const latest = ordered[0]
  const signature = latest?.signature
    ?? latest?.transactionSignature
    ?? latest?.transaction?.signatures?.[0]
    ?? latest?.tx?.signature
    ?? latest?.signatures?.[0]
    ?? ''
  const rawTimestamp = Number(latest?.timestamp ?? latest?.blockTime ?? latest?.tx?.blockTime ?? 0)
  const timestamp = Number.isFinite(rawTimestamp) ? rawTimestamp : 0

  return {
    wallet,
    lastSignature: String(signature),
    lastActivityTimestamp: timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000,
    transactionCount: ordered.length,
  }
}
