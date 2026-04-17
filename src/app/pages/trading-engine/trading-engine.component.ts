import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { TradingService, PlaceOrderDto } from '../../services/trading.service';
import { BondService } from '../../services/bond.service';
import { PriceSimulationService, BookRow, TradeRow } from '../../services/price-simulation.service';
import { Order, Bond } from '../../core/models/api.models';

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
    this.sim.stop();
  }

  private startClock() {
    import('rxjs').then(({ interval }) => {
      this.clockSub = interval(1000).subscribe(() => {
        this.marketTime.set(this.formatTime());
      });
    });
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
        const { bids, asks } = this.sim.orderBook(tick.price, 5);
        this.bids.set(bids);
        this.asks.set(asks);
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
    const { bids, asks } = this.sim.orderBook(mid, 5);
    this.bids.set(bids);
    this.asks.set(asks);
    // Seed with a few initial trades
    this.recentTrades.set(
      Array.from({ length: 7 }, () => this.sim.randomTrade(mid))
        .sort(() => Math.random() - 0.5)
    );
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

  placeOrder() {
    const bond = this.selectedBond();
    if (!bond.id) {
      this.orderError.set('No bond selected — please wait for the bond list to load.');
      return;
    }
    if (this.quantity <= 0) {
      this.orderError.set('Quantity must be greater than 0.');
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
        this.loadOrders();
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
      },
      error: () => this.cancellingId.set(null),
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
