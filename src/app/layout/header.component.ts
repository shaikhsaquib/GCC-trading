import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgClass],
  template: `
    <header class="header">
      <!-- Left: market ticker -->
      <div class="ticker-bar">
        @for (ticker of tickers; track ticker.symbol) {
          <div class="ticker-item">
            <span class="ticker-symbol">{{ ticker.symbol }}</span>
            <span class="ticker-price">{{ ticker.price }}</span>
            <span class="ticker-change" [ngClass]="ticker.up ? 'up' : 'down'">
              {{ ticker.up ? '▲' : '▼' }} {{ ticker.change }}
            </span>
          </div>
        }
      </div>

      <!-- Right: actions -->
      <div class="header-actions">
        <!-- Search -->
        <div class="header-search">
          <span class="material-icons-round search-ic">search</span>
          <input type="text" placeholder="Search bonds, ISIN, issuer..." />
          <kbd>⌘K</kbd>
        </div>

        <!-- Market status -->
        <div class="market-status">
          <span class="status-dot active"></span>
          <span>Market Open</span>
        </div>

        <!-- Notifications -->
        <button class="icon-btn" title="Notifications">
          <span class="material-icons-round">notifications</span>
          <span class="notif-badge">5</span>
        </button>

        <!-- Settings -->
        <button class="icon-btn" title="Settings">
          <span class="material-icons-round">settings</span>
        </button>

        <!-- Avatar -->
        <div class="header-avatar">AH</div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: var(--header-height);
      background: var(--bg-dark);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      gap: 20px;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .ticker-bar {
      display: flex;
      align-items: center;
      gap: 24px;
      overflow: hidden;
    }

    .ticker-item {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .ticker-symbol {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: 0.5px;
    }

    .ticker-price {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .ticker-change {
      font-size: 11px;
      font-weight: 600;
      &.up   { color: var(--success); }
      &.down { color: var(--danger); }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .header-search {
      position: relative;
      display: flex;
      align-items: center;

      .search-ic {
        position: absolute;
        left: 10px;
        font-size: 18px;
        color: var(--text-muted);
      }

      input {
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 7px 60px 7px 36px;
        color: var(--text-primary);
        font-size: 13px;
        font-family: inherit;
        width: 260px;
        outline: none;
        transition: border-color 0.2s;

        &::placeholder { color: var(--text-muted); }
        &:focus { border-color: var(--accent-cyan); }
      }

      kbd {
        position: absolute;
        right: 10px;
        font-size: 10px;
        color: var(--text-muted);
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 5px;
      }
    }

    .market-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--success);
      background: rgba(46, 213, 115, 0.08);
      border: 1px solid rgba(46, 213, 115, 0.2);
      padding: 5px 12px;
      border-radius: 20px;
    }

    .icon-btn {
      position: relative;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-card);
        color: var(--text-primary);
      }

      .material-icons-round { font-size: 20px; }
    }

    .notif-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      background: var(--danger);
      color: white;
      border-radius: 50%;
      font-size: 9px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-teal));
      color: var(--bg-darkest);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  `],
})
export class HeaderComponent {
  tickers = [
    { symbol: 'SAR/USD', price: '0.2666', change: '0.02%', up: true },
    { symbol: 'BRENT', price: '82.40', change: '1.2%', up: true },
    { symbol: 'TASI', price: '11,842', change: '0.45%', up: false },
    { symbol: 'SUKUK-5Y', price: '98.75', change: '0.12%', up: true },
    { symbol: 'GOV-10Y', price: '4.25%', change: '0.05%', up: false },
  ];
}
