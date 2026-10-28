'use client'

type LoginMethod = 'email' | 'google'

// Privy owns provider availability and authentication, as in the original frontend.
// Keep the provider and every sign-in entry point on the same configuration.
export const PRIVY_LOGIN_METHODS: LoginMethod[] = ['email', 'google']

/** Shared email/social sign-in; external wallets retain their existing connection flow. */
export function usePrivyLoginMethods(): LoginMethod[] {
  return PRIVY_LOGIN_METHODS
}
