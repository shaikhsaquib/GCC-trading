import { Component, signal } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  template: `
    <div class="wallet-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Wallet & Payments</h2>
          <p>Manage your funds — deposit, withdraw and track transactions</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-node">Node.js</span>
          <button class="btn btn-secondary"><span class="material-icons-round">history</span> History</button>
          <button class="btn btn-primary" (click)="activeAction.set('deposit')">
            <span class="material-icons-round">add</span> Add Funds
          </button>
        </div>
      </div>

      <!-- Balance Cards -->
      <div class="balance-cards">
        <div class="balance-card primary">
          <div class="balance-label">Total Portfolio Value</div>
          <div class="balance-amount">SAR 1,284,500.00</div>
          <div class="balance-sub">
            <span class="text-success">▲ 3.42% (SAR 42,620) this month</span>
          </div>
          <div class="balance-actions">
            <button class="btn btn-primary btn-sm" (click)="activeAction.set('deposit')">
              <span class="material-icons-round">add_circle</span> Deposit
            </button>
            <button class="btn btn-secondary btn-sm" (click)="activeAction.set('withdraw')">
              <span class="material-icons-round">remove_circle</span> Withdraw
            </button>
            <button class="btn btn-secondary btn-sm" (click)="activeAction.set('transfer')">
              <span class="material-icons-round">swap_horiz</span> Transfer
            </button>
          </div>
        </div>

        <div class="balance-sub-grid">
          @for (b of subBalances; track b.label) {
            <div class="balance-sub-card">
              <div class="sub-icon" [style.background]="b.iconBg">
                <span class="material-icons-round" [style.color]="b.iconColor">{{ b.icon }}</span>
              </div>
              <div>
                <div class="sub-label">{{ b.label }}</div>
                <div class="sub-amount">{{ b.amount }}</div>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="wallet-layout">
        <!-- Left: Action Panel -->
        <div class="action-panel">
          @if (activeAction() === 'deposit') {
            <div class="card fade-in">
              <h4 style="margin-bottom:20px">Deposit Funds</h4>
              <div class="form-group">
                <label>Payment Method</label>
                <div class="method-list">
                  @for (m of paymentMethods; track m.id) {
                    <div class="method-item" [class.selected]="selectedMethod() === m.id" (click)="selectedMethod.set(m.id)">
                      <span class="material-icons-round" [style.color]="m.color">{{ m.icon }}</span>
                      <div>
                        <strong>{{ m.label }}</strong>
                        <small>{{ m.desc }}</small>
                      </div>
                      @if (selectedMethod() === m.id) {
                        <span class="material-icons-round" style="color:var(--accent-cyan);margin-left:auto">radio_button_checked</span>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="form-group">
                <label>Amount (SAR)</label>
                <div class="amount-input-wrapper">
                  <span class="currency-symbol">SAR</span>
                  <input class="form-control" type="number" placeholder="0.00" style="padding-left:54px;font-size:18px;font-weight:700" [(ngModel)]="depositAmount" name="da"/>
                </div>
                <div class="quick-amounts">
                  @for (qa of [10000, 50000, 100000, 500000]; track qa) {
                    <button class="chip" (click)="depositAmount = qa">SAR {{ qa | number }}</button>
                  }
                </div>
              </div>
              <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
                <span class="material-icons-round">add_circle</span> Deposit SAR {{ depositAmount | number }}
              </button>
            </div>
          }

          @if (activeAction() === 'withdraw') {
            <div class="card fade-in">
              <h4 style="margin-bottom:20px">Withdraw Funds</h4>
              <div class="form-group">
                <label>Bank Account</label>
                <select class="form-control form-select" name="ba">
                  <option>Al Rajhi Bank — IBAN SA03 8000 0000 6080 1016 7519</option>
                  <option>Riyad Bank — IBAN SA46 2000 0001 2345 6789 1234</option>
                </select>
              </div>
              <div class="form-group">
                <label>Amount (SAR)</label>
                <div class="amount-input-wrapper">
                  <span class="currency-symbol">SAR</span>
                  <input class="form-control" type="number" placeholder="0.00" style="padding-left:54px;font-size:18px;font-weight:700" [(ngModel)]="withdrawAmount" name="wa"/>
                </div>
              </div>
              <div class="withdraw-info">
                <div class="info-row"><span>Available Balance</span><span>SAR 248,320.00</span></div>
                <div class="info-row"><span>Processing Time</span><span>1-2 business days</span></div>
                <div class="info-row"><span>Fee</span><span style="color:var(--success)">Free</span></div>
              </div>
              <button class="btn btn-danger btn-lg" style="width:100%;justify-content:center">
                <span class="material-icons-round">remove_circle</span> Withdraw SAR {{ withdrawAmount | number }}
              </button>
            </div>
          }

          @if (activeAction() === 'transfer') {
            <div class="card fade-in">
              <h4 style="margin-bottom:20px">Internal Transfer</h4>
              <div class="form-group">
                <label>Recipient User ID or Email</label>
                <input class="form-control" type="text" placeholder="Enter user ID or email" name="rid"/>
              </div>
              <div class="form-group">
                <label>Amount (SAR)</label>
                <div class="amount-input-wrapper">
                  <span class="currency-symbol">SAR</span>
                  <input class="form-control" type="number" placeholder="0.00" style="padding-left:54px;font-size:18px;font-weight:700" name="ta"/>
                </div>
              </div>
              <div class="form-group">
                <label>Note (Optional)</label>
                <input class="form-control" type="text" placeholder="Transfer note" name="tn"/>
              </div>
              <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
                <span class="material-icons-round">swap_horiz</span> Transfer Funds
              </button>
            </div>
          }

          <!-- Mini Chart: Balance Over Time -->
          <div class="card mini-chart-card">
            <h4 style="margin-bottom:16px">Balance Trend (30 days)</h4>
            <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.3"/>
                  <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path [attr.d]="chartPath" fill="url(#chartFill)"/>
              <path [attr.d]="chartLine" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="chart-labels">
              <span>Mar 16</span><span>Mar 23</span><span>Mar 30</span><span>Apr 6</span><span>Apr 13</span>
            </div>
          </div>
        </div>

        <!-- Right: Transaction History -->
        <div class="card transactions-panel">
          <div class="panel-header">
            <h4>Transaction History</h4>
            <div class="header-filters">
              @for (tf of txFilters; track tf) {
                <span class="chip" [class.active]="txFilter() === tf" (click)="txFilter.set(tf)">{{ tf }}</span>
              }
            </div>
          </div>

          <div class="search-bar" style="margin-bottom:16px">
            <span class="material-icons-round search-icon">search</span>
            <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search transactions..." name="ts"/>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Date</th>
                <th>Status</th>
                <th style="text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (tx of transactions; track tx.id) {
                <tr>
                  <td>
                    <div class="tx-type-icon" [style.background]="tx.iconBg">
                      <span class="material-icons-round" [style.color]="tx.iconColor" style="font-size:16px">{{ tx.icon }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="tx-desc">
                      <strong>{{ tx.desc }}</strong>
                      <small>{{ tx.ref }}</small>
                    </div>
                  </td>
                  <td style="color:var(--text-secondary)">{{ tx.date }}</td>
                  <td><span class="badge" [ngClass]="txStatusBadge(tx.status)">{{ tx.status }}</span></td>
                  <td style="text-align:right; font-weight:700" [style.color]="tx.amount > 0 ? 'var(--success)' : 'var(--danger)'">
                    {{ tx.amount > 0 ? '+' : '' }}SAR {{ Math.abs(tx.amount) | number:'1.2-2' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="table-footer">
            <span class="text-muted">Showing 10 of 284 transactions</span>
            <div class="pagination">
              <button class="btn btn-secondary btn-sm">Previous</button>
              <button class="btn btn-secondary btn-sm active">1</button>
              <button class="btn btn-secondary btn-sm">2</button>
              <button class="btn btn-secondary btn-sm">3</button>
              <button class="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wallet-layout { display: grid; grid-template-columns: 360px 1fr; gap: 20px; }

    .balance-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }

    .balance-card {
      border-radius: var(--radius-lg); padding: 28px;
      &.primary {
        background: linear-gradient(135deg, #0d2440 0%, #0a3060 100%);
        border: 1px solid rgba(0,212,255,0.2);
      }
    }

    .balance-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

    .balance-amount { font-size: 32px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; margin-bottom: 8px; }

    .balance-sub { font-size: 13px; margin-bottom: 20px; }

    .balance-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .balance-sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .balance-sub-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 16px; display: flex; align-items: center; gap: 12px;
    }

    .sub-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; .material-icons-round { font-size: 20px; } }

    .sub-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }

    .sub-amount { font-size: 16px; font-weight: 700; }

    .method-list { display: flex; flex-direction: column; gap: 10px; }

    .method-item {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer;
      background: var(--bg-input); transition: all 0.2s;
      .material-icons-round { font-size: 22px; }
      strong { display: block; font-size: 13px; }
      small { font-size: 11px; color: var(--text-secondary); }
      &.selected { border-color: var(--accent-cyan); background: rgba(0,212,255,0.06); }
      &:hover:not(.selected) { border-color: var(--border-light); }
    }

    .amount-input-wrapper { position: relative; }
    .currency-symbol { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: 700; color: var(--text-secondary); font-size: 13px; }

    .quick-amounts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }

    .withdraw-info { background: var(--bg-input); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }

    .info-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); span:last-child { color: var(--text-primary); font-weight: 500; } }

    .mini-chart-card { margin-top: 16px; }

    .chart-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 6px; }

    .transactions-panel { padding: 20px; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; h4 { font-size: 14px; font-weight: 700; } }

    .header-filters { display: flex; gap: 6px; }

    .tx-type-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

    .tx-desc { display: flex; flex-direction: column; gap: 2px; strong { font-size: 13px; } small { font-size: 11px; color: var(--text-secondary); } }

    .table-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }

    .pagination { display: flex; gap: 6px; }

    .btn.active { background: rgba(0,212,255,0.1); color: var(--accent-cyan); border-color: var(--accent-cyan); }
  `],
})
export class WalletComponent {
  activeAction = signal('deposit');
  selectedMethod = signal('bank');
  txFilter = signal('All');
  depositAmount = 0;
  withdrawAmount = 0;
  Math = Math;

  txFilters = ['All', 'Deposits', 'Withdrawals', 'Trades', 'Coupons'];

  subBalances = [
    { label: 'Available Cash', amount: 'SAR 248,320', icon: 'account_balance_wallet', iconBg: 'rgba(0,212,255,0.1)', iconColor: 'var(--accent-cyan)' },
    { label: 'Invested', amount: 'SAR 920,000', icon: 'trending_up', iconBg: 'rgba(23,195,178,0.1)', iconColor: 'var(--accent-teal)' },
    { label: 'Pending', amount: 'SAR 116,180', icon: 'pending', iconBg: 'rgba(255,193,7,0.1)', iconColor: 'var(--warning)' },
    { label: 'Coupon Income', amount: 'SAR 48,200', icon: 'payments', iconBg: 'rgba(46,213,115,0.1)', iconColor: 'var(--success)' },
  ];

  paymentMethods = [
    { id: 'bank', icon: 'account_balance', label: 'Bank Transfer (SADAD)', desc: 'Instant · Free', color: 'var(--accent-cyan)' },
    { id: 'mada', icon: 'credit_card', label: 'Mada Card', desc: 'Instant · 0.5% fee', color: 'var(--accent-teal)' },
    { id: 'stc', icon: 'phone_android', label: 'STC Pay', desc: 'Instant · Free', color: 'var(--accent-purple)' },
  ];

  transactions = [
    { id: 1, icon: 'add_circle', iconBg: 'rgba(46,213,115,0.12)', iconColor: 'var(--success)', desc: 'Bank Transfer Deposit', ref: 'TXN-20240415-001', date: 'Apr 15, 2024', status: 'Completed', amount: 500000 },
    { id: 2, icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)', desc: 'Bond Purchase — ISIN SA123456789', ref: 'TRD-20240415-042', date: 'Apr 15, 2024', status: 'Completed', amount: -250000 },
    { id: 3, icon: 'payments', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)', desc: 'Coupon Payment Received', ref: 'CPN-20240410-018', date: 'Apr 10, 2024', status: 'Completed', amount: 12500 },
    { id: 4, icon: 'remove_circle', iconBg: 'rgba(255,71,87,0.12)', iconColor: 'var(--danger)', desc: 'Withdrawal to Al Rajhi Bank', ref: 'WDR-20240408-007', date: 'Apr 8, 2024', status: 'Processing', amount: -100000 },
    { id: 5, icon: 'swap_horiz', iconBg: 'rgba(124,77,255,0.12)', iconColor: 'var(--accent-purple)', desc: 'Bond Sale — ISIN SA987654321', ref: 'TRD-20240406-031', date: 'Apr 6, 2024', status: 'Completed', amount: 185000 },
    { id: 6, icon: 'add_circle', iconBg: 'rgba(46,213,115,0.12)', iconColor: 'var(--success)', desc: 'SADAD Payment Received', ref: 'TXN-20240402-012', date: 'Apr 2, 2024', status: 'Completed', amount: 300000 },
    { id: 7, icon: 'payments', iconBg: 'rgba(0,212,255,0.12)', iconColor: 'var(--accent-cyan)', desc: 'Maturity Payment — ISIN SA000000001', ref: 'MAT-20240401-003', date: 'Apr 1, 2024', status: 'Completed', amount: 500000 },
  ];

  chartPath = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15 L300,100 L0,100 Z';
  chartLine = 'M0,80 C20,75 40,65 60,60 S90,45 120,40 S150,30 180,25 S210,20 240,22 S270,18 300,15';

  txStatusBadge(s: string) { return { 'badge-success': s === 'Completed', 'badge-warning': s === 'Processing', 'badge-danger': s === 'Failed' }; }
}
