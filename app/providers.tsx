'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import type { Adapter } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'
import { makeQueryClient } from '@/lib/query/client'
import { ToastProvider } from '@/components/ui'
import { HELIUS_CONFIG } from '@/constants'

// Set in the Privy dashboard (dashboard.privy.io). REQUIRED: Privy rejects anything
// that isn't a 25-char app id at construction, so the build/app fails fast without it.
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''
const SOLANA_WALLET_ADAPTERS: Adapter[] = []

export function Providers({ children }: { children: ReactNode }) {
  // One query client per browser session; never shared across server requests.
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Privy owns email/embedded-wallet onboarding. Installed browser wallets
        // use Solana Wallet Adapter below so extension detection stays local to
        // the page instead of falling through to Privy's download links.
        loginMethods: ['email'],
        appearance: {
          walletChainType: 'solana-only',
          // Matches the capsule builder: dark panel with the Heres red for the primary action.
          theme: '#221C26',
          accentColor: '#C8131A',
        },
        embeddedWallets: {
          // Auto-create a Solana embedded wallet for every user on login.
          solana: { createOnLogin: 'all-users' },
          // Demo: sign without a per-action confirmation modal so a multi-tx flow
          // (capsule creation) runs popup-free. Flip to true to require confirmations.
          showWalletUIs: false,
        },
      }}
    >
      <ConnectionProvider endpoint={HELIUS_CONFIG.PUBLIC_RPC_URL}>
        <WalletProvider wallets={SOLANA_WALLET_ADAPTERS} autoConnect>
          <WalletModalProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>{children}</ToastProvider>
              <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </PrivyProvider>
  )
}
