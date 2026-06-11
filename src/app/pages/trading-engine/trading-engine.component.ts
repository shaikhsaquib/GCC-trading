import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, interval, timer, forkJoin, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { TradingService, PlaceOrderDto } from '../../services/trading.service';
import { BondService } from '../../services/bond.service';
import { PriceSimulationService, BookRow, TradeRow } from '../../services/price-simulation.service';
import { ToastService } from '../../core/services/toast.service';
import { Order, Bond, OrderBookEntry } from '../../core/models/api.models';

interface WatchlistBond {
  id:        string;
  name:      string;
  isin:      string;
  shortName: string;
  price:     string;
  change:    number;
  changePct: number;
  coupon:    number;
  ytm:       number;
  maturity:  string;
  rating:    string;
}

interface OrderDisplay {
  id:     string;
  side:   string;
  bond:   string;
  type:   string;
  qty:    number;
  price:  string;
  filled: number;
  status: string;
}

@Component({
  selector: 'app-trading-engine',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './trading-engine.component.html',
  styleUrl: './trading-engine.component.css',
})
export class TradingEngineComponent implements OnInit, OnDestroy {
  private readonly tradingSvc = inject(TradingService);
  private readonly bondSvc    = inject(BondService);
  private readonly route      = inject(ActivatedRoute);
  private readonly sim        = inject(PriceSimulationService);
  private readonly toast      = inject(ToastService);

  orderSide  = signal<'buy' | 'sell'>('buy');
  orderType  = signal('Limit');
  orderTypes = ['Market', 'Limit'];
  quantity   = 1000;
  limitPrice = 100.25;
  tif        = 'Day';

  loading       = signal(true);
  ordersLoading = signal(true);
  submitting    = signal(false);
  orderSuccess  = signal<string | null>(null);
  orderError    = signal<string | null>(null);
  cancellingId  = signal<string | null>(null);
  cancellingAll = signal(false);
  bookLoading   = signal(false);

  marketTime = signal(this.formatTime());
  marketOpen = signal(true);

  selectedBond = signal<WatchlistBond>({
    id: '', name: '—', isin: '—', shortName: '—',
    price: '—', change: 0, changePct: 0, coupon: 0, ytm: 0, maturity: '—', rating: '—',
  });

  private _watchlist = signal<WatchlistBond[]>([]);
  private _myOrders  = signal<OrderDisplay[]>([]);

  asks         = signal<BookRow[]>([]);
  bids         = signal<BookRow[]>([]);
  recentTrades = signal<TradeRow[]>([]);

  private tickSub:  Subscription | null = null;
  private tradeSub: Subscription | null = null;
  private clockSub: Subscription | null = null;
  private bookSub:  Subscription | null = null;

  get watchlist() { return this._watchlist(); }
  get myOrders()  {
    return this._myOrders().filter(o =>
      o.status !== 'Cancelled' && o.status !== 'Filled' && o.status !== 'Rejected'
    );
  }

  ngOnInit() {
    this.loadBonds();
    this.loadOrders();
    this.startClock();
  }

  ngOnDestroy() {
    this.tickSub?.unsubscribe();
    this.tradeSub?.unsubscribe();
    this.clockSub?.unsubscribe();
    this.bookSub?.unsubscribe();
    this.sim.stop();
  }

  private startClock() {
    this.updateMarketStatus();
    this.clockSub = interval(1000).subscribe(() => {
      this.marketTime.set(this.formatTime());
      this.updateMarketStatus();
    });
  }

  /** GCC market hours: Sun–Thu 09:00–17:00 Asia/Riyadh (UTC+3). */
  private updateMarketStatus() {
    const now = new Date();
    const m = (now.getUTCHours() * 60 + now.getUTCMinutes() + 180) % 1440;
    const d = now.getUTCDay();
    this.marketOpen.set(d >= 0 && d <= 4 && m >= 540 && m < 1020);
  }

  private formatTime(): string {
    return new Date().toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  private loadBonds() {
    const preselectedId = this.route.snapshot.queryParamMap.get('bondId');
    this.bondSvc.search({ page: 1, pageSize: 20, status: 'Active' }).subscribe({
      next: res => {
        this.loading.set(false);
        const bonds = (res.data?.items ?? []).map(b => this.mapWatchlistBond(b));
        this._watchlist.set(bonds);

        // Register all bonds with the simulation engine
        bonds.forEach(b => this.sim.registerBond(b.id, parseFloat(b.price) || 100));
        this.sim.start();
        this.subscribeToTicks();

        const target = preselectedId
          ? bonds.find(b => b.id === preselectedId) ?? bonds[0]
          : bonds[0];
        if (target) {
          this.activateBond(target);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private subscribeToTicks() {
    this.tickSub?.unsubscribe();
    this.tickSub = this.sim.ticks$.subscribe(tick => {
      // Update watchlist price for this bond
      this._watchlist.update(list =>
        list.map(b => b.id === tick.bondId
          ? { ...b, price: tick.price.toFixed(2), change: tick.change, changePct: +tick.changePct.toFixed(3) }
          : b
        )
      );
      // If it's the selected bond, update price display + order book
      if (this.selectedBond().id === tick.bondId) {
        this.selectedBond.update(b => ({
          ...b,
          price:     tick.price.toFixed(2),
          change:    tick.change,
          changePct: +tick.changePct.toFixed(3),
        }));
        this.limitPrice = +tick.price.toFixed(2);
        // 60% chance of a new trade on each tick
        if (Math.random() < 0.6) {
          const trade = this.sim.randomTrade(tick.price);
          this.recentTrades.update(list => [trade, ...list].slice(0, 12));
        }
      }
    });
  }

  private activateBond(bond: WatchlistBond) {
    this.selectedBond.set(bond);
    this.limitPrice = parseFloat(bond.price) || 100.25;
    const mid = parseFloat(bond.price) || 100;
    this.startBookPolling(bond.id);
    // Seed with a few initial trades (simulated demo feed)
    this.recentTrades.set(
      Array.from({ length: 7 }, () => this.sim.randomTrade(mid))
        .sort(() => Math.random() - 0.5)
    );
  }

  /** Poll the real order book API every 5 seconds for the selected bond. */
  private startBookPolling(bondId: string) {
    this.bookSub?.unsubscribe();
    this.bids.set([]);
    this.asks.set([]);
    if (!bondId) return;

    this.bookLoading.set(true);
    this.bookSub = timer(0, 5000).pipe(
      switchMap(() => this.tradingSvc.getOrderBook(bondId, 10).pipe(
        catchError(() => of(null)),
      )),
    ).subscribe(res => {
      this.bookLoading.set(false);
      const book = res?.data;
      const bids = book?.bids ?? [];
      const asks = book?.asks ?? [];
      const maxQty = Math.max(1, ...bids.map(e => e.quantity), ...asks.map(e => e.quantity));
      this.bids.set(bids.map(e => this.toBookRow(e, maxQty)));
      // Best (lowest) ask rendered closest to the mid-price divider
      this.asks.set(asks.slice().reverse().map(e => this.toBookRow(e, maxQty)));
    });
  }

  private toBookRow(e: OrderBookEntry, maxQty: number): BookRow {
    return {
      price: e.price.toFixed(2),
      qty:   e.quantity,
      depth: Math.max(4, Math.round((e.quantity / maxQty) * 95)),
      total: ((e.price * e.quantity) / 1_000_000).toFixed(2),
    };
  }

  private loadOrders() {
    this.tradingSvc.getMyOrders(undefined, 20).subscribe({
      next: res => {
        this.ordersLoading.set(false);
        this._myOrders.set((res.data ?? []).map(o => this.mapOrder(o)));
      },
      error: () => this.ordersLoading.set(false),
    });
  }

  private mapWatchlistBond(b: Bond): WatchlistBond {
    return {
      id:        b.id,
      name:      b.name,
      isin:      b.isin,
      shortName: b.isin.slice(-8),
      price:     b.currentPrice?.toFixed(2) ?? '100.00',
      change:    0,
      changePct: 0,
      coupon:    b.couponRate,
      ytm:       +(b.couponRate * 0.95 + Math.random() * 0.5).toFixed(2),
      maturity:  new Date(b.maturityDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      rating:    b.creditRating,
    };
  }

  private mapOrder(o: Order): OrderDisplay {
    return {
      id:     o.id,
      side:   o.side.toUpperCase(),
      bond:   o.bondId.slice(0, 8),
      type:   o.orderType,
      qty:    o.quantity,
      price:  o.price != null ? o.price.toFixed(2) : 'Market',
      filled: o.quantity > 0 ? Math.round((o.filledQuantity / o.quantity) * 100) : 0,
      status: o.status,
    };
  }

  selectBond(bond: WatchlistBond) {
    this.activateBond(bond);
  }

  /** True when the order form fails basic validation; bound to the submit button + hints. */
  get orderInvalid(): boolean {
    if (!this.quantity || this.quantity <= 0) return true;
    if (this.orderType() !== 'Market' && (!this.limitPrice || this.limitPrice <= 0)) return true;
    return false;
  }

  placeOrder() {
    const bond = this.selectedBond();
    if (!bond.id) {
      this.orderError.set('No bond selected — please wait for the bond list to load.');
      return;
    }
    if (this.orderInvalid) {
      this.orderError.set(this.quantity <= 0
        ? 'Quantity must be greater than 0.'
        : 'Limit price must be greater than 0.');
      return;
    }

    this.submitting.set(true);
    this.orderError.set(null);
    this.orderSuccess.set(null);

    const dto: PlaceOrderDto = {
      bondId:    bond.id,
      side:      this.orderSide() === 'buy' ? 'Buy' : 'Sell',
      orderType: this.orderType() as 'Market' | 'Limit',
      quantity:  this.quantity,
      price:     this.orderType() !== 'Market' ? this.limitPrice : undefined,
    };

    this.tradingSvc.placeOrder(dto).subscribe({
      next: res => {
        this.submitting.set(false);
        this.orderSuccess.set(`Order #${res.data.id.slice(0, 8)} placed successfully`);
        this.toast.success(`Order #${res.data.id.slice(0, 8)} placed successfully`, 'Order Placed');
        this.loadOrders();
        // Refresh the book immediately so the new order shows up
        this.startBookPolling(bond.id);
        setTimeout(() => this.orderSuccess.set(null), 5000);
      },
      error: err => {
        this.submitting.set(false);
        this.orderError.set(
          err?.error?.error?.message ?? err?.error?.message ?? err?.message ?? 'Order placement failed'
        );
      },
    });
  }

  cancelOrder(id: string) {
    this.cancellingId.set(id);
    this.tradingSvc.cancelOrder(id).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this._myOrders.update(list => list.filter(o => o.id !== id));
        this.toast.info('Order cancelled');
      },
      error: err => {
        this.cancellingId.set(null);
        this.toast.error(
          err?.error?.error?.message ?? err?.error?.message ?? 'Could not cancel the order'
        );
      },
    });
  }

  cancelAllOrders() {
    const orders = this.myOrders;
    if (orders.length === 0 || this.cancellingAll()) return;
    if (!confirm(`Cancel all ${orders.length} open order${orders.length > 1 ? 's' : ''}?`)) return;

    this.cancellingAll.set(true);
    forkJoin(orders.map(o =>
      this.tradingSvc.cancelOrder(o.id).pipe(
        map(() => true),
        catchError(() => of(false)),
      )
    )).subscribe(results => {
      this.cancellingAll.set(false);
      const failed = results.filter(ok => !ok).length;
      if (failed === 0) {
        this.toast.info(`${results.length} order${results.length > 1 ? 's' : ''} cancelled`);
      } else {
        this.toast.error(`${failed} of ${results.length} orders could not be cancelled`);
      }
      this.loadOrders();
      this.startBookPolling(this.selectedBond().id);
    });
  }

  get estimatedValue(): number {
    const px = parseFloat(this.selectedBond().price) || this.limitPrice;
    return this.quantity * (this.orderType() === 'Market' ? px : this.limitPrice);
  }
  get commission(): number { return this.estimatedValue * 0.001; }
  get vat():        number { return this.commission * 0.15; }
  get orderTotal(): number { return this.estimatedValue + this.commission + this.vat; }
}
