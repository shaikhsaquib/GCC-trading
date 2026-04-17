import { Injectable } from '@angular/core';
import { Subject, interval, Subscription } from 'rxjs';

export interface PriceTick {
  bondId:    string;
  price:     number;
  change:    number;
  changePct: number;
}

export interface BookRow {
  price: string;
  qty:   number;
  depth: number;
  total: string;
}

export interface TradeRow {
  id:    number;
  side:  'BUY' | 'SELL';
  price: string;
  qty:   number;
  time:  string;
}

@Injectable({ providedIn: 'root' })
export class PriceSimulationService {
  private basePrices    = new Map<string, number>();
  private openPrices    = new Map<string, number>();
  private currentPrices = new Map<string, number>();

  private tickSub: Subscription | null = null;
  private tradeIdCounter = 1000;

  readonly ticks$  = new Subject<PriceTick>();
  readonly trades$ = new Subject<TradeRow>();

  /** Register a bond's opening price. Called once when bonds are loaded. */
  registerBond(id: string, price: number): void {
    if (!this.basePrices.has(id)) {
      this.basePrices.set(id, price);
      this.openPrices.set(id, price);
      this.currentPrices.set(id, price);
    }
  }

  /** Start emitting ticks for all registered bonds. */
  start(): void {
    if (this.tickSub) return;
    this.tickSub = interval(2500).subscribe(() => this.emitAll());
  }

  stop(): void {
    this.tickSub?.unsubscribe();
    this.tickSub = null;
  }

  currentPrice(id: string): number {
    return this.currentPrices.get(id) ?? this.basePrices.get(id) ?? 100;
  }

  orderBook(midPrice: number, depth = 5): { bids: BookRow[]; asks: BookRow[] } {
    const spread = 0.05;
    const mkRow = (px: number): BookRow => {
      const qty = Math.round(1000 + Math.random() * 8000);
      return { price: px.toFixed(2), qty, depth: Math.min(95, 20 + Math.round(qty / 120)), total: (qty / 1000).toFixed(1) };
    };
    return {
      asks: Array.from({ length: depth }, (_, i) => mkRow(midPrice + (i + 0.5) * spread + (Math.random() - 0.5) * 0.01)),
      bids: Array.from({ length: depth }, (_, i) => mkRow(midPrice - (i + 0.5) * spread - (Math.random() - 0.5) * 0.01)),
    };
  }

  randomTrade(midPrice: number): TradeRow {
    const side: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const px   = (midPrice + (Math.random() - 0.5) * 0.04).toFixed(2);
    const qty  = Math.round((0.5 + Math.random() * 4.5) * 1000);
    const now  = new Date();
    const time = now.toTimeString().slice(0, 8);
    return { id: this.tradeIdCounter++, side, price: px, qty, time };
  }

  private emitAll(): void {
    this.currentPrices.forEach((price, id) => {
      const base = this.basePrices.get(id)!;
      const open = this.openPrices.get(id)!;
      // Mean-reverting random walk: drift pulls price back toward base slowly
      const drift   = (base - price) * 0.05;
      const noise   = (Math.random() - 0.5) * 0.06;
      const next    = Math.max(base * 0.97, Math.min(base * 1.03, price + drift + noise));
      this.currentPrices.set(id, next);
      this.ticks$.next({
        bondId:    id,
        price:     next,
        change:    next - open,
        changePct: ((next - open) / open) * 100,
      });
    });
  }
}
