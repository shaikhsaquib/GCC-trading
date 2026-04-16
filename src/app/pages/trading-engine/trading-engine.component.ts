import { Component, signal, inject, OnInit } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TradingService, PlaceOrderDto } from '../../services/trading.service';
import { BondService } from '../../services/bond.service';
import { Order, Bond } from '../../core/models/api.models';

interface WatchlistBond {
  id:        string;
  name:      string;
  isin:      string;
  shortName: string;
  price:     string;
  change:    number;
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
export class TradingEngineComponent implements OnInit {
  private readonly tradingSvc = inject(TradingService);
  private readonly bondSvc    = inject(BondService);
  private readonly route      = inject(ActivatedRoute);

  orderSide  = signal<'buy' | 'sell'>('buy');
  orderType  = signal('Limit');
  orderTypes = ['Market', 'Limit', 'Stop', 'Stop-Limit'];
  quantity   = 1000;
  limitPrice = 100.25;
  stopPrice  = 99.50;
  tif        = 'Day';

  loading      = signal(true);
  ordersLoading= signal(true);
  submitting   = signal(false);
  orderSuccess = signal<string | null>(null);
  orderError   = signal<string | null>(null);

  selectedBond = signal<WatchlistBond>({
    id: '', name: '—', isin: '—', shortName: '—',
    price: '—', change: 0, coupon: 0, ytm: 0, maturity: '—', rating: '—',
  });

  private _watchlist = signal<WatchlistBond[]>([]);
  private _myOrders  = signal<OrderDisplay[]>([]);

  // Static order book — would come from WebSocket in production
  asks = [
    { price: '101.70', qty: 2400, depth: 48, total: '2.4' },
    { price: '101.65', qty: 5100, depth: 72, total: '5.1' },
    { price: '101.60', qty: 3800, depth: 60, total: '3.8' },
    { price: '101.55', qty: 7200, depth: 85, total: '7.2' },
    { price: '101.50', qty: 4600, depth: 65, total: '4.6' },
  ];

  bids = [
    { price: '101.45', qty: 6800, depth: 80, total: '6.8' },
    { price: '101.40', qty: 3200, depth: 50, total: '3.2' },
    { price: '101.35', qty: 8500, depth: 95, total: '8.5' },
    { price: '101.30', qty: 2100, depth: 35, total: '2.1' },
    { price: '101.25', qty: 4900, depth: 68, total: '4.9' },
  ];

  recentTrades = [
    { id: 1, side: 'BUY',  price: '101.45', qty: 2000, time: '14:32:01' },
    { id: 2, side: 'SELL', price: '101.44', qty: 500,  time: '14:31:58' },
    { id: 3, side: 'BUY',  price: '101.46', qty: 1500, time: '14:31:55' },
    { id: 4, side: 'BUY',  price: '101.45', qty: 3000, time: '14:31:50' },
    { id: 5, side: 'SELL', price: '101.43', qty: 800,  time: '14:31:45' },
    { id: 6, side: 'SELL', price: '101.44', qty: 2200, time: '14:31:40' },
    { id: 7, side: 'BUY',  price: '101.45', qty: 1000, time: '14:31:38' },
  ];

  get watchlist() { return this._watchlist(); }
  get myOrders()  { return this._myOrders(); }

  ngOnInit() {
    this.loadBonds();
    this.loadOrders();
  }

  private loadBonds() {
    const preselectedId = this.route.snapshot.queryParamMap.get('bondId');
    this.bondSvc.search({ page: 1, pageSize: 10, status: 'Active' }).subscribe({
      next: res => {
        this.loading.set(false);
        const bonds = (res.data?.items ?? []).map(b => this.mapWatchlistBond(b));
        this._watchlist.set(bonds);
        // Auto-select the bond coming from the marketplace, otherwise default to first
        const target = preselectedId
          ? bonds.find(b => b.id === preselectedId) ?? bonds[0]
          : bonds[0];
        if (target) {
          this.selectedBond.set(target);
          this.limitPrice = parseFloat(target.price) || 100.25;
        }
      },
      error: () => this.loading.set(false),
    });
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
      price:     b.currentPrice?.toFixed(2) ?? '—',
      change:    0,
      coupon:    b.couponRate,
      ytm:       0,
      maturity:  new Date(b.maturityDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      rating:    b.creditRating,
    };
  }

  private mapOrder(o: Order): OrderDisplay {
    const fillPct = o.quantity > 0 ? Math.round((o.filledQuantity / o.quantity) * 100) : 0;
    return {
      id:     o.id,
      side:   o.side.toUpperCase(),
      bond:   o.bondId,
      type:   o.orderType,
      qty:    o.quantity,
      price:  o.price != null ? o.price.toFixed(2) : 'Market',
      filled: fillPct,
      status: o.status,
    };
  }

  placeOrder() {
    const bond = this.selectedBond();
    if (!bond || this.quantity <= 0) return;

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
        this.orderError.set(err?.error?.error ?? err?.error?.message ?? 'Order placement failed');
      },
    });
  }

  cancelOrder(id: string) {
    this.tradingSvc.cancelOrder(id).subscribe({
      next: () => {
        this._myOrders.update(list =>
          list.map(o => o.id === id ? { ...o, status: 'Cancelled' } : o)
        );
      },
    });
  }

  selectBond(bond: WatchlistBond) {
    this.selectedBond.set(bond);
    this.limitPrice = parseFloat(bond.price) || this.limitPrice;
    // Refresh order book for selected bond
    this.tradingSvc.getOrderBook(bond.id, 5).subscribe({
      next: res => {
        if (!res.data) return;
        const { bids, asks } = res.data;
        this.bids = bids.slice(0, 5).map((b, i) => ({
          price: b.price.toFixed(2),
          qty:   b.quantity,
          depth: Math.min(95, Math.round((b.quantity / (bids[0]?.quantity || 1)) * 95)),
          total: (b.quantity / 1000).toFixed(1),
        }));
        this.asks = asks.slice(0, 5).map((a, i) => ({
          price: a.price.toFixed(2),
          qty:   a.quantity,
          depth: Math.min(95, Math.round((a.quantity / (asks[0]?.quantity || 1)) * 95)),
          total: (a.quantity / 1000).toFixed(1),
        }));
      },
    });
  }
}
