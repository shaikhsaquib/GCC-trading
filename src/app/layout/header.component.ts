import { Component, inject, computed, signal, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutService } from './layout.service';
import { AuthService } from '../core/services/auth.service';
import { NotificationsService } from '../services/notifications.service';
import { BondService } from '../services/bond.service';

interface Ticker { symbol: string; price: string; change: string; up: boolean; }

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  readonly layout           = inject(LayoutService);
  readonly auth             = inject(AuthService);
  private readonly notifSvc = inject(NotificationsService);
  private readonly bondSvc  = inject(BondService);
  private readonly router   = inject(Router);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  // ── User ─────────────────────────────────────────────────────────────────────

  readonly userInitials = computed(() => {
    const u = this.auth.user();
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  readonly userName = computed(() => {
    const u = this.auth.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  readonly userRole = computed(() => {
    const labels: Record<string, string> = {
      ADMIN: 'Admin', L2_ADMIN: 'L2 Admin',
      COMPLIANCE: 'Compliance', KYC_OFFICER: 'KYC Officer', INVESTOR: 'Investor',
    };
    return labels[this.auth.user()?.role ?? ''] ?? '';
  });

  // ── Notifications ─────────────────────────────────────────────────────────────

  readonly unreadCount = signal(0);

  // ── Market status ─────────────────────────────────────────────────────────────
  // GCC market hours: Sun–Thu 09:00–17:00 Asia/Riyadh (UTC+3)

  readonly marketOpen = computed(() => {
    const now = new Date();
    const riyadhMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 180) % 1440;
    const day = now.getUTCDay(); // 0=Sun … 6=Sat
    return day >= 0 && day <= 4 && riyadhMinutes >= 540 && riyadhMinutes < 1020;
  });

  // ── Tickers ───────────────────────────────────────────────────────────────────

  readonly tickers = signal<Ticker[]>([
    { symbol: 'SAR/USD',  price: '0.2666', change: '0.02%', up: true  },
    { symbol: 'BRENT',    price: '82.40',  change: '1.20%', up: true  },
    { symbol: 'TASI',     price: '11,842', change: '0.45%', up: false },
    { symbol: 'SUKUK-5Y', price: '98.75',  change: '0.12%', up: true  },
    { symbol: 'GOV-10Y',  price: '4.25%',  change: '0.05%', up: false },
  ]);

  // ── Search ────────────────────────────────────────────────────────────────────

  searchQuery = '';

  // ── Profile dropdown ──────────────────────────────────────────────────────────

  showProfileMenu = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadUnreadCount();
    this.loadTickers();
  }

  private loadUnreadCount(): void {
    this.notifSvc.getAll(50, 0).subscribe({
      next: notifs => this.unreadCount.set(notifs.filter(n => !n.read).length),
      error: () => {},
    });
  }

  private loadTickers(): void {
    this.bondSvc.search({ pageSize: 5 }).subscribe({
      next: res => {
        const bonds = res.data?.items ?? [];
        if (!bonds.length) return;
        this.tickers.set(bonds.map(b => {
          const pct = ((b.currentPrice - b.faceValue) / b.faceValue) * 100;
          return {
            symbol: b.name.length > 14 ? b.name.slice(0, 14) + '…' : b.name,
            price:  b.currentPrice.toFixed(2),
            change: `${Math.abs(pct).toFixed(2)}%`,
            up:     pct >= 0,
          };
        }));
      },
      error: () => {}, // keep static fallback on API failure
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  goToNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.searchQuery.trim()) {
      this.router.navigate(['/marketplace'], {
        queryParams: { search: this.searchQuery.trim() },
      });
      this.searchQuery = '';
    }
    if (event.key === 'Escape') {
      this.searchQuery = '';
      this.searchInputRef?.nativeElement.blur();
    }
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
  }

  goToProfile(): void {
    this.showProfileMenu = false;
    this.router.navigate(['/identity']);
  }

  logout(): void {
    this.showProfileMenu = false;
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.header-avatar-wrap')) {
      this.showProfileMenu = false;
    }
  }

  // Ctrl+K / ⌘K focuses search
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.searchInputRef?.nativeElement.focus();
    }
  }
}
