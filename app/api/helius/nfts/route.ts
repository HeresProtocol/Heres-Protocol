import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaAddress } from '@/config/solana'
import { getNftsByOwner } from '@/lib/helius'

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')?.trim() || ''
    if (!wallet) {
      return NextResponse.json({ error: 'wallet query parameter is required' }, { status: 400 })
    }
    if (!isValidSolanaAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const items = await getNftsByOwner(wallet)
    return NextResponse.json({ items })
  } catch (error: any) {
    const unavailable = error?.message === 'Helius NFT service is temporarily unavailable'
    return NextResponse.json(
      { error: unavailable ? error.message : 'Failed to fetch NFTs' },
      { status: unavailable ? 503 : 500 }
    )
  }
}
