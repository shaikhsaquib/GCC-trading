import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-trading-engine',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  template: `
    <div class="trading-page fade-in">
      <div class="page-header" style="margin-bottom:16px">
        <div class="page-title">
          <h2>Trading Engine</h2>
          <p>Place buy/sell orders and match trades in real time</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-dotnet">.NET Core</span>
          <div class="market-status-pill">
            <span class="status-dot active"></span> Market Open · SAT Apr 15, 2024 · 14:32:07 AST
          </div>
        </div>
      </div>

      <!-- Bond Selector -->
      <div class="bond-selector-bar">
        @for (bond of watchlist; track bond.isin) {
          <div class="watchlist-item" [class.active]="selectedBond().isin === bond.isin" (click)="selectedBond.set(bond)">
            <span class="wi-name">{{ bond.shortName }}</span>
            <span class="wi-price">{{ bond.price }}</span>
            <span class="wi-change" [class.up]="bond.change > 0" [class.down]="bond.change < 0">
              {{ bond.change > 0 ? '+' : '' }}{{ bond.change }}%
            </span>
          </div>
        }
        <button class="btn btn-secondary btn-sm"><span class="material-icons-round" style="font-size:16px">add</span> Add</button>
      </div>

      <div class="trading-layout">

        <!-- Order Form -->
        <div class="order-panel card">
          <div class="selected-bond-info">
            <h4>{{ selectedBond().name }}</h4>
            <p style="font-size:12px;color:var(--text-secondary)">{{ selectedBond().isin }}</p>
            <div class="price-display">
              <span class="current-price">{{ selectedBond().price }}</span>
              <span class="price-change" [class.up]="selectedBond().change > 0" [class.down]="selectedBond().change < 0">
                {{ selectedBond().change > 0 ? '+' : '' }}{{ selectedBond().change }}%
              </span>
            </div>
            <div class="bond-quick-stats">
              <div class="bqs"><span>Coupon</span><strong class="text-cyan">{{ selectedBond().coupon }}%</strong></div>
              <div class="bqs"><span>YTM</span><strong>{{ selectedBond().ytm }}%</strong></div>
              <div class="bqs"><span>Maturity</span><strong>{{ selectedBond().maturity }}</strong></div>
              <div class="bqs"><span>Rating</span><strong>{{ selectedBond().rating }}</strong></div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Buy/Sell Tabs -->
          <div class="order-side-tabs">
            <button class="side-tab buy" [class.active]="orderSide() === 'buy'" (click)="orderSide.set('buy')">
              <span class="material-icons-round">trending_up</span> Buy
            </button>
            <button class="side-tab sell" [class.active]="orderSide() === 'sell'" (click)="orderSide.set('sell')">
              <span class="material-icons-round">trending_down</span> Sell
            </button>
          </div>

          <div class="order-form">
            <div class="form-group">
              <label>Order Type</label>
              <div class="order-type-tabs">
                @for (ot of orderTypes; track ot) {
                  <button class="ot-tab" [class.active]="orderType() === ot" (click)="orderType.set(ot)">{{ ot }}</button>
                }
              </div>
            </div>

            <div class="form-group">
              <label>Quantity (Units)</label>
              <input class="form-control" type="number" [(ngModel)]="quantity" name="qty" placeholder="0"/>
              <div class="quick-amounts">
                @for (q of [100,500,1000,5000]; track q) {
                  <span class="chip" (click)="quantity = q">{{ q | number }}</span>
                }
              </div>
            </div>

            @if (orderType() !== 'Market') {
              <div class="form-group">
                <label>Limit Price (SAR per unit)</label>
                <input class="form-control" type="number" [(ngModel)]="limitPrice" name="lp" placeholder="100.00"/>
              </div>
            }

            @if (orderType() === 'Stop') {
              <div class="form-group">
                <label>Stop Price</label>
                <input class="form-control" type="number" [(ngModel)]="stopPrice" name="sp" placeholder="99.50"/>
              </div>
            }

            <div class="form-group">
              <label>Time in Force</label>
              <select class="form-control form-select" [(ngModel)]="tif" name="tif">
                <option>Day</option>
                <option>Good Till Cancel (GTC)</option>
                <option>Fill or Kill (FOK)</option>
                <option>Immediate or Cancel (IOC)</option>
              </select>
            </div>

            <!-- Order Summary -->
            <div class="order-summary">
              <div class="os-row"><span>Estimated Value</span><span>SAR {{ (quantity * 100.25) | number:'1.2-2' }}</span></div>
              <div class="os-row"><span>Commission (0.10%)</span><span>SAR {{ (quantity * 100.25 * 0001) | number:'1.2-2' }}</span></div>
              <div class="os-row"><span>VAT (15%)</span><span>SAR {{ (quantity * 100.25 * 0.00015) | number:'1.2-2' }}</span></div>
              <div class="os-row total"><span>Total</span><span [style.color]="orderSide() === 'buy' ? 'var(--success)' : 'var(--danger)'">
                SAR {{ (quantity * 100.25 * 1.001) | number:'1.2-2' }}
              </span></div>
            </div>

            <button class="btn btn-lg submit-order-btn"
              [class.buy-btn]="orderSide() === 'buy'"
              [class.sell-btn]="orderSide() === 'sell'"
              style="width:100%;justify-content:center">
              <span class="material-icons-round">{{ orderSide() === 'buy' ? 'trending_up' : 'trending_down' }}</span>
              {{ orderSide() === 'buy' ? 'Place Buy Order' : 'Place Sell Order' }}
            </button>
          </div>
        </div>

        <!-- Order Book -->
        <div class="card order-book-card">
          <div class="card-header-row">
            <h4>Order Book</h4>
            <span style="font-size:12px;color:var(--text-secondary)">{{ selectedBond().name }}</span>
          </div>

          <div class="spread-bar">
            <span>Bid</span>
            <div class="spread-center">
              <span class="spread-price">{{ selectedBond().price }}</span>
              <span class="spread-label">Spread: 0.05</span>
            </div>
            <span>Ask</span>
          </div>

          <!-- Asks (top, reversed) -->
          <div class="asks-list">
            @for (ask of asks; track ask.price) {
              <div class="book-row ask-row">
                <div class="book-depth ask-depth" [style.width]="ask.depth + '%'"></div>
                <span class="book-price ask-price">{{ ask.price }}</span>
                <span class="book-qty">{{ ask.qty | number }}</span>
                <span class="book-total">SAR {{ ask.total }}M</span>
              </div>
            }
          </div>

          <div class="book-divider">
            <span class="mid-price">{{ selectedBond().price }}</span>
            <span class="mid-label">Mid Price</span>
          </div>

          <!-- Bids (bottom) -->
          <div class="bids-list">
            @for (bid of bids; track bid.price) {
              <div class="book-row bid-row">
                <div class="book-depth bid-depth" [style.width]="bid.depth + '%'"></div>
                <span class="book-price bid-price">{{ bid.price }}</span>
                <span class="book-qty">{{ bid.qty | number }}</span>
                <span class="book-total">SAR {{ bid.total }}M</span>
              </div>
            }
          </div>
        </div>

        <!-- Right panel: Recent Trades + My Orders -->
        <div class="right-panel">
          <div class="card trades-card">
            <h4 style="margin-bottom:14px">Recent Trades</h4>
            <div class="trades-list">
              @for (trade of recentTrades; track trade.id) {
                <div class="trade-row" [class.buy]="trade.side === 'BUY'" [class.sell]="trade.side === 'SELL'">
                  <span class="trade-side">{{ trade.side }}</span>
                  <span class="trade-price">{{ trade.price }}</span>
                  <span class="trade-qty">{{ trade.qty | number }}</span>
                  <span class="trade-time">{{ trade.time }}</span>
                </div>
              }
            </div>
          </div>

          <div class="card my-orders-card">
            <div style="display:flex;justify-content:space-between;margin-bottom:14px">
              <h4>My Open Orders</h4>
              <button class="btn btn-secondary btn-sm">Cancel All</button>
            </div>
            @for (order of myOrders; track order.id) {
              <div class="my-order-row">
                <span class="side-pill" [class.buy]="order.side==='BUY'" [class.sell]="order.side==='SELL'">{{ order.side }}</span>
                <div class="order-info">
                  <strong>{{ order.bond }}</strong>
                  <small>{{ order.type }} &middot; {{ order.qty | number }} units &#64; {{ order.price }}</small>
                </div>
                <div>
                  <div class="progress-bar" style="width:80px;margin-bottom:3px">
                    <div class="progress-fill" [style.width]="order.filled + '%'"></div>
                  </div>
                  <small style="font-size:10px;color:var(--text-muted)">{{ order.filled }}% filled</small>
                </div>
                <button class="btn btn-danger btn-sm">Cancel</button>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .trading-page { height: calc(100vh - 120px); display: flex; flex-direction: column; }

    .market-status-pill {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 20px; font-size: 12px; color: var(--text-secondary);
    }

    .bond-selector-bar {
      display: flex; align-items: center; gap: 4px; padding: 10px 0;
      margin-bottom: 16px; overflow-x: auto;
    }

    .watchlist-item {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
      cursor: pointer; white-space: nowrap; transition: all 0.15s;
      &.active { border-color: var(--accent-cyan); background: rgba(0,212,255,0.08); }
      &:hover:not(.active) { border-color: var(--border-light); }
    }

    .wi-name  { font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .wi-price { font-size: 13px; font-weight: 700; }
    .wi-change { font-size: 11px; font-weight: 600; &.up { color: var(--success); } &.down { color: var(--danger); } }

    .trading-layout { display: grid; grid-template-columns: 300px 1fr 300px; gap: 16px; flex: 1; min-height: 0; }

    /* Order Panel */
    .order-panel { padding: 18px; overflow-y: auto; }

    .selected-bond-info { margin-bottom: 12px; }

    .price-display { display: flex; align-items: baseline; gap: 10px; margin: 8px 0; }
    .current-price { font-size: 28px; font-weight: 800; }
    .price-change { font-size: 14px; font-weight: 600; &.up { color: var(--success); } &.down { color: var(--danger); } }

    .bond-quick-stats { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }

    .bqs { display: flex; flex-direction: column; gap: 2px; span { font-size: 10px; color: var(--text-muted); text-transform: uppercase; } strong { font-size: 13px; } }

    .order-side-tabs { display: flex; gap: 8px; margin-bottom: 18px; }

    .side-tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px; border: 2px solid var(--border); border-radius: var(--radius-sm);
      background: var(--bg-input); font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: inherit; transition: all 0.2s;
      .material-icons-round { font-size: 18px; }

      &.buy.active { border-color: var(--success); background: rgba(46,213,115,0.1); color: var(--success); }
      &.sell.active { border-color: var(--danger); background: rgba(255,71,87,0.1); color: var(--danger); }
      &:not(.active) { color: var(--text-secondary); }
    }

    .order-type-tabs { display: flex; gap: 4px; }

    .ot-tab {
      flex: 1; padding: 6px; text-align: center; font-size: 11px; font-weight: 600;
      background: var(--bg-input); border: 1px solid var(--border); border-radius: 4px;
      cursor: pointer; font-family: inherit; color: var(--text-secondary); transition: all 0.15s;
      &.active { background: rgba(0,212,255,0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); }
    }

    .quick-amounts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }

    .order-summary {
      background: var(--bg-input); border-radius: var(--radius-sm); padding: 12px;
      margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px;
    }

    .os-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); span:last-child { color: var(--text-primary); } }

    .os-row.total { border-top: 1px solid var(--border); padding-top: 8px; font-weight: 700; span:first-child { color: var(--text-primary); } }

    .submit-order-btn {
      &.buy-btn  { background: var(--success);  color: #000; }
      &.sell-btn { background: var(--danger);   color: #fff; }
    }

    /* Order Book */
    .order-book-card { padding: 16px; display: flex; flex-direction: column; overflow: hidden; }

    .card-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; h4 { font-size: 14px; font-weight: 700; } }

    .spread-bar { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }

    .spread-center { text-align: center; }
    .spread-price { display: block; font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .spread-label { font-size: 10px; color: var(--text-muted); }

    .asks-list, .bids-list { display: flex; flex-direction: column; gap: 3px; }
    .asks-list { margin-bottom: 6px; }

    .book-row { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border-radius: 4px; position: relative; cursor: pointer; overflow: hidden; &:hover { background: var(--bg-card-hover); } }

    .book-depth { position: absolute; top: 0; bottom: 0; right: 0; opacity: 0.12; border-radius: 4px; }
    .ask-depth { background: var(--danger); }
    .bid-depth { background: var(--success); }

    .book-price { font-size: 13px; font-weight: 600; min-width: 60px; }
    .ask-price { color: var(--danger); }
    .bid-price { color: var(--success); }

    .book-qty   { font-size: 12px; color: var(--text-secondary); flex: 1; text-align: right; }
    .book-total { font-size: 11px; color: var(--text-muted); min-width: 60px; text-align: right; }

    .book-divider { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin: 4px 0; }
    .mid-price { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .mid-label { font-size: 10px; color: var(--text-muted); }

    /* Right Panel */
    .right-panel { display: flex; flex-direction: column; gap: 14px; overflow: hidden; }

    .trades-card { padding: 16px; flex: 1; overflow: hidden; }

    .trades-list { display: flex; flex-direction: column; gap: 4px; }

    .trade-row { display: grid; grid-template-columns: 40px 1fr 1fr 1fr; gap: 8px; padding: 6px 8px; border-radius: 4px; font-size: 12px; font-variant-numeric: tabular-nums; &.buy { background: rgba(46,213,115,0.04); } &.sell { background: rgba(255,71,87,0.04); } }

    .trade-side { font-weight: 700; font-size: 11px; &.buy { color: var(--success); } }
    .trade-row.buy .trade-side  { color: var(--success); }
    .trade-row.sell .trade-side { color: var(--danger); }

    .trade-price { font-weight: 600; }
    .trade-qty   { color: var(--text-secondary); text-align: right; }
    .trade-time  { color: var(--text-muted); text-align: right; }

    .my-orders-card { padding: 16px; }

    .my-order-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(30,58,95,0.4); &:last-child { border: none; } }

    .side-pill { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; &.buy { background: rgba(46,213,115,0.15); color: var(--success); } &.sell { background: rgba(255,71,87,0.15); color: var(--danger); } }

    .order-info { flex: 1; strong { display: block; font-size: 12px; } small { font-size: 10px; color: var(--text-secondary); } }

    .order-form { display: flex; flex-direction: column; gap: 14px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; } }
  `],
})
export class TradingEngineComponent {
  orderSide = signal<'buy' | 'sell'>('buy');
  orderType = signal('Limit');
  orderTypes = ['Market', 'Limit', 'Stop', 'Stop-Limit'];
  quantity = 1000;
  limitPrice = 100.25;
  stopPrice = 99.50;
  tif = 'Day';

  selectedBond = signal({
    name: 'Saudi Govt. Bond 2029', isin: 'SA1230001234',
    shortName: 'SAG-2029', price: '101.45',
    change: 0.28, coupon: 4.25, ytm: 3.98, maturity: 'Mar 2029', rating: 'AAA',
  });

  watchlist = [
    { name: 'Saudi Govt. Bond 2029', isin: 'SA1230001234', shortName: 'SAG-2029', price: '101.45', change: 0.28, coupon: 4.25, ytm: 3.98, maturity: 'Mar 2029', rating: 'AAA' },
    { name: 'Saudi Aramco Sukuk 2026', isin: 'SA2340015678', shortName: 'ARMC-2026', price: '99.82', change: -0.12, coupon: 3.75, ytm: 3.83, maturity: 'Jun 2026', rating: 'AA+' },
    { name: 'SABIC Bond 2028', isin: 'SA3450029012', shortName: 'SABIC-2028', price: '100.75', change: 0.45, coupon: 4.50, ytm: 4.34, maturity: 'Dec 2028', rating: 'AA' },
    { name: 'Abu Dhabi Govt. 2030', isin: 'AE0040012345', shortName: 'ADG-2030', price: '98.60', change: -0.08, coupon: 3.90, ytm: 4.12, maturity: 'Sep 2030', rating: 'AA' },
  ];

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

  myOrders = [
    { id: 1, side: 'BUY',  bond: 'SAG-2029', type: 'Limit', qty: 5000, price: '101.40', filled: 60 },
    { id: 2, side: 'SELL', bond: 'ARMC-2026', type: 'Limit', qty: 2000, price: '99.90', filled: 0 },
    { id: 3, side: 'BUY',  bond: 'ADG-2030', type: 'Market', qty: 1000, price: 'Market', filled: 100 },
  ];
}
