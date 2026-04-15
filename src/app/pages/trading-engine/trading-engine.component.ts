import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-trading-engine',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './trading-engine.component.html',
  styleUrl: './trading-engine.component.css',
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
