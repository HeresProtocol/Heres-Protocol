'use client'

import { useEffect, useRef, useState } from 'react'
import type { CatalogAsset } from './useAssetCatalog'
import type { NftItem } from '@/hooks/useCreateCapsuleForm'
import { StepHead } from './CreateShell'
import {
  IconCheck,
  IconChevron,
  IconChevronDown,
  IconCopy,
  IconInfo,
  IconLogout,
  IconNft,
  IconSolana,
  IconTokens,
  IconX,
  TokenIcon,
  fmtAmount,
  fmtCompact,
  fmtUsd,
  maskAddr,
} from './ui'

export type AssetTab = 'sol' | 'tokens' | 'nfts'

/* ---------------- wallet chip ---------------- */

export function WalletChip({ address, onDisconnect }: { address: string; onDisconnect: () => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  return (
    <div className="cf-walletchip" ref={ref}>
      <button type="button" className="cf-walletchip__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="cf-walletchip__avatar" aria-hidden />
        <span>{maskAddr(address, 6, 4)}</span>
        <IconChevronDown />
      </button>
      {open && (
        <div className="cf-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>
            {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copied' : 'Copy address'}
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDisconnect() }}>
            <IconLogout /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------- pieces ---------------- */

function Section({ title, count, open, onToggle, children }: { title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="cf-section">
      <button type="button" className="cf-section-h" aria-expanded={open} onClick={onToggle}>
        <span className="cf-section-h__left">
          {title}
          {count != null && <span className="cf-count">{count}</span>}
        </span>
        <IconChevron />
      </button>
      {open && children}
    </div>
  )
}

function AssetRow({
  asset,
  checked,
  onToggle,
  caption,
  balance,
}: {
  asset: CatalogAsset
  checked: boolean
  onToggle: () => void
  caption?: string
  /** Balance shown in the row (SOL shows its full wallet balance; the selectable part is below the fee reserve). */
  balance: number | null
}) {
  const isSol = !asset.mint
  const disabled = !asset.balanceBaseUnits || asset.balanceBaseUnits <= 0n
  const usd = balance != null && asset.usdPrice != null ? balance * asset.usdPrice : null
  return (
    <label className={`cf-asset-row${disabled ? ' cf-asset-row--disabled' : ''}`} title={disabled && isSol ? 'Not enough SOL: 0.08 SOL stays in your wallet for network fees.' : undefined}>
      <TokenIcon icon={asset.icon} symbol={asset.displaySymbol} isSol={isSol} />
      <span style={{ minWidth: 0 }}>
        <span className="cf-asset-row__sym" style={{ display: 'block' }}>{asset.displaySymbol}</span>
        <span className="cf-asset-row__name" style={{ display: 'block' }}>{asset.name}</span>
      </span>
      <span className="cf-asset-row__bal">
        {caption && <span className="cf-asset-row__cap" style={{ display: 'block' }}>{caption}</span>}
        <span className="cf-asset-row__amt" style={{ display: 'block' }}>
          {balance == null ? <span className="cf-skel-line" aria-label="Loading balance" /> : fmtCompact(balance)}
          {balance == null ? null : isSol ? ' SOL' : asset.displaySymbol.length <= 8 ? <small>{asset.displaySymbol}</small> : null}
        </span>
        <span className="cf-asset-row__usd" style={{ display: 'block' }}>{balance == null ? <span className="cf-skel-line cf-skel-line--sm" /> : usd == null ? '—' : fmtUsd(usd)}</span>
      </span>
      <input type="checkbox" className="cf-check" checked={checked} disabled={disabled} onChange={onToggle} aria-label={`Include ${asset.displaySymbol}`} />
    </label>
  )
}

/* ---------------- step ---------------- */

export function StepAssets(props: {
  address: string
  onDisconnect: () => void
  portfolioUsd: number | null | undefined
  pricesIndicative: boolean
  tab: AssetTab
  onTab: (tab: AssetTab) => void
  catalog: CatalogAsset[]
  solTotal: number | null
  stakedSol: number | null
  solPrice: number | null
  selectedKeys: string[]
  selectedAmounts: Record<string, string>
  onToggleAsset: (key: string) => void
  tokensLoading: boolean
  tokensError: boolean
  onRetryTokens: () => void
  nftList: NftItem[]
  nftLoading: boolean
  nftError: boolean
  onRetryNfts: () => void
  selectedNftMints: string[]
  onToggleNft: (mint: string) => void
  isNftMode: boolean
  error: string | null
  canContinue: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const [openSol, setOpenSol] = useState(true)
  const [openSpl, setOpenSpl] = useState(true)
  const sol = props.catalog.find((a) => !a.mint)
  const tokens = props.catalog.filter((a) => a.mint)
  const selected = props.isNftMode
    ? props.selectedNftMints
    : props.selectedKeys.filter((k) => props.catalog.some((a) => a.key === k))
  const hasPanel = selected.length > 0

  const tabs: { key: AssetTab; label: string; icon: React.ReactNode }[] = [
    { key: 'sol', label: 'All assets', icon: <IconSolana /> },
    { key: 'tokens', label: 'SPL tokens', icon: <IconTokens /> },
    { key: 'nfts', label: 'NFTs', icon: <IconNft /> },
  ]

  const actions = (
    <div className="cf-foot__actions">
      <button type="button" className="cf-btn cf-btn--ghost" onClick={props.onBack}>Back</button>
      <button type="button" className="cf-btn cf-btn--light" disabled={!props.canContinue} onClick={props.onContinue}>Continue</button>
    </div>
  )

  return (
    <div className={`cf-body cf-body--assets${hasPanel ? ' cf-body--panel' : ''}`}>
      <StepHead
        eyebrow="Step 1 of 4"
        title="Select assets to protect"
        sub="Balances below are from your connected Solana wallet. You can choose which assets you want to include in your inheritance plan."
      />
      <div className="cf-walletbar">
        <WalletChip address={props.address} onDisconnect={props.onDisconnect} />
        <div className="cf-portfolio">
          <p className="cf-portfolio__label">
            Total Portfolio Value
            {props.pricesIndicative && <span className="cf-tag" title="Devnet balances priced at mainnet rates, for reference only">Indicative</span>}
          </p>
          <p className="cf-portfolio__value">{props.portfolioUsd === undefined ? <span className="cf-skel-line" /> : fmtUsd(props.portfolioUsd)}</p>
        </div>
      </div>

      <div className={`cf-assets${hasPanel ? ' cf-assets--with-panel' : ''}`}>
        <div className="cf-assets__main">
          <div className="cf-tabs" role="tablist" aria-label="Asset type" style={{ '--cf-tab': tabs.findIndex((t) => t.key === props.tab) } as React.CSSProperties}>
            <span className="cf-tabs__thumb" aria-hidden />
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" className="cf-tab" aria-selected={props.tab === t.key} onClick={() => props.onTab(t.key)}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="cf-list cf-panel cf-scroll" role="tabpanel">
            {props.tab === 'nfts' ? (
              <>
                <p className="cf-empty">A capsule holds either tokens or standard SPL/Token-2022 NFTs. Compressed and Core NFTs are not supported. Choosing NFTs replaces your token selection for this capsule.</p>
                {props.nftLoading ? (
                  <div className="cf-nft-grid">{[0, 1, 2].map((i) => <div key={i} className="cf-skel" style={{ margin: 0, aspectRatio: '1', height: 'auto' }} />)}</div>
                ) : props.nftError ? (
                  <p className="cf-empty" role="alert">
                    Couldn&rsquo;t load your NFTs. <button type="button" className="cf-link" onClick={props.onRetryNfts}>Retry</button>
                  </p>
                ) : props.nftList.length === 0 ? (
                  <p className="cf-empty">No NFTs found in this wallet.</p>
                ) : (
                  <div className="cf-nft-grid">
                    {props.nftList.map((nft) => {
                      const on = props.selectedNftMints.includes(nft.mint)
                      return (
                        <button key={nft.mint} type="button" className="cf-nft" aria-pressed={on} onClick={() => props.onToggleNft(nft.mint)}>
                          <span className="cf-nft__img">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {nft.imageUri ? <img src={nft.imageUri} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <IconNft />}
                          </span>
                          <span className="cf-nft__meta">
                            {nft.name || 'Untitled NFT'}
                            <small>{maskAddr(nft.mint, 4, 4)}</small>
                          </span>
                          <input type="checkbox" className="cf-check" checked={on} readOnly tabIndex={-1} aria-hidden />
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="cf-empty">Choose from your wallet&rsquo;s available assets on the current network. USDC and other SPL or Token-2022 tokens appear here when you hold a balance; unrecognized tokens are identified by their mint address.</p>
                {props.tab === 'sol' && sol && (
                  <Section title="SOL" open={openSol} onToggle={() => setOpenSol((v) => !v)}>
                    <div className="cf-group">
                      <AssetRow
                        asset={sol}
                        balance={props.solTotal}
                        caption="Total balance"
                        checked={props.selectedKeys.includes(sol.key)}
                        onToggle={() => props.onToggleAsset(sol.key)}
                      />
                      <div className="cf-staked">
                        <span className="cf-staked__label">Staked</span>
                        <span className="cf-staked__amt">
                          {props.stakedSol == null ? <span className="cf-skel-line" /> : `${fmtAmount(props.stakedSol)} SOL`}
                          <span className="cf-staked__usd" style={{ display: 'block' }}>
                            {props.stakedSol == null ? <span className="cf-skel-line cf-skel-line--sm" /> : props.solPrice != null ? fmtUsd(props.stakedSol * props.solPrice) : '—'}
                          </span>
                        </span>
                        <span className="cf-staked__info" title="Staked SOL can't be placed in a capsule. Unstake it first if you want to include it." aria-label="Staked SOL can't be placed in a capsule. Unstake it first if you want to include it." role="img">
                          <IconInfo />
                        </span>
                      </div>
                    </div>
                  </Section>
                )}
                <Section title="SPL Tokens" count={props.tokensLoading ? undefined : tokens.length} open={openSpl} onToggle={() => setOpenSpl((v) => !v)}>
                  {props.tokensLoading && tokens.length === 0 ? (
                    <>
                      <div className="cf-skel" />
                      <div className="cf-skel" />
                    </>
                  ) : props.tokensError ? (
                    <p className="cf-empty">
                      Couldn&rsquo;t load your tokens.
                      <button type="button" className="cf-link" onClick={props.onRetryTokens}>Retry</button>
                    </p>
                  ) : tokens.length === 0 ? (
                    <p className="cf-empty">No token balances found on this network. Tokens held on another network will not appear here.</p>
                  ) : (
                    <div className="cf-group">
                      {tokens.map((asset) => (
                        <AssetRow
                          key={asset.key}
                          asset={asset}
                          balance={asset.balanceUi}
                          checked={props.selectedKeys.includes(asset.key)}
                          onToggle={() => props.onToggleAsset(asset.key)}
                        />
                      ))}
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>

        {hasPanel && (
          <div className="cf-assets__side">
          <aside className="cf-selected cf-panel" aria-label="Selected assets">
            <div className="cf-selected__h">
              <strong>Selected assets</strong>
              <span>{selected.length} {selected.length === 1 ? 'asset' : 'assets'}</span>
            </div>
            <div className="cf-selected__list cf-scroll">
              {props.isNftMode
                ? props.selectedNftMints.map((mint) => {
                    const nft = props.nftList.find((n) => n.mint === mint)
                    return (
                      <div key={mint} className="cf-sel-item">
                        <span className="cf-asset-row__icon">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {nft?.imageUri ? <img src={nft.imageUri} alt="" /> : <span>NFT</span>}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="cf-sel-item__sym" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nft?.name || 'NFT'}</span>
                          <span className="cf-sel-item__name">{maskAddr(mint, 4, 4)}</span>
                        </span>
                        <span className="cf-sel-item__amt">1</span>
                        <button type="button" className="cf-x" onClick={() => props.onToggleNft(mint)} aria-label="Remove NFT"><IconX /></button>
                      </div>
                    )
                  })
                : props.selectedKeys.map((key) => {
                    const asset = props.catalog.find((a) => a.key === key)
                    if (!asset) return null
                    const amount = Number(props.selectedAmounts[key] || 0)
                    const usd = asset.usdPrice != null ? amount * asset.usdPrice : null
                    return (
                      <div key={key} className="cf-sel-item">
                        <TokenIcon icon={asset.icon} symbol={asset.displaySymbol} isSol={!asset.mint} />
                        <span style={{ minWidth: 0 }}>
                          <span className="cf-sel-item__sym">{asset.displaySymbol}</span>
                          <span className="cf-sel-item__name">{asset.mint ? asset.name : 'Keeps 0.08 for fees'}</span>
                        </span>
                        <span className="cf-sel-item__amt">
                          {fmtCompact(amount)}{asset.displaySymbol.length <= 8 ? ` ${asset.displaySymbol}` : ''}
                          <small>{usd == null ? '—' : fmtUsd(usd)}</small>
                        </span>
                        <button type="button" className="cf-x" onClick={() => props.onToggleAsset(key)} aria-label={`Remove ${asset.displaySymbol}`}><IconX /></button>
                      </div>
                    )
                  })}
            </div>
            <p className="cf-selected__foot"><IconInfo /> You can change your selection at any time before continuing.</p>
          </aside>
          {props.error && <p className="cf-foot__note cf-foot__note--err" role="alert">{props.error}</p>}
          {actions}
          </div>
        )}
      </div>

      {!hasPanel && (
        <footer className="cf-foot">
          {props.error ? <p className="cf-foot__note cf-foot__note--err" role="alert">{props.error}</p> : <span />}
          {actions}
        </footer>
      )}
    </div>
  )
}
