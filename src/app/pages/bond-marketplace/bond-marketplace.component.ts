import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bond-marketplace',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="marketplace-page fade-in">
      <div class="page-header">
        <div class="page-title">
          <h2>Bond Marketplace</h2>
          <p>List, search, filter and compare bonds from GCC and global issuers</p>
        </div>
        <div class="page-actions">
          <span class="badge badge-dotnet">.NET Core</span>
          <button class="btn btn-secondary" (click)="viewMode.set(viewMode() === 'table' ? 'grid' : 'table')">
            <span class="material-icons-round">{{ viewMode() === 'table' ? 'grid_view' : 'table_rows' }}</span>
          </button>
          <button class="btn btn-primary"><span class="material-icons-round">compare</span> Compare ({{ compareList().length }})</button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(4,1fr); margin-bottom:20px">
        @for (s of marketStats; track s.label) {
          <div class="stat-card" style="padding:16px">
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" style="font-size:20px">{{ s.value }}</div>
            <div class="stat-change" [class.up]="s.up" [class.down]="!s.up">{{ s.up ? '▲' : '▼' }} {{ s.chg }}</div>
          </div>
        }
      </div>

      <div class="marketplace-layout">
        <!-- Filter Sidebar -->
        <aside class="filter-sidebar card">
          <h4 style="margin-bottom:16px">Filters</h4>

          <div class="filter-section">
            <div class="filter-label">Bond Type</div>
            @for (t of bondTypes; track t) {
              <label class="filter-check">
                <input type="checkbox" [checked]="true" style="accent-color:var(--accent-cyan)"/> {{ t }}
              </label>
            }
          </div>

          <div class="filter-section">
            <div class="filter-label">Issuer Region</div>
            @for (r of regions; track r) {
              <label class="filter-check">
                <input type="checkbox" [checked]="true" style="accent-color:var(--accent-cyan)"/> {{ r }}
              </label>
            }
          </div>

          <div class="filter-section">
            <div class="filter-label">Coupon Rate (%)</div>
            <div class="range-inputs">
              <input class="form-control" type="number" placeholder="Min" style="font-size:12px" [(ngModel)]="minCoupon" name="minc"/>
              <span>—</span>
              <input class="form-control" type="number" placeholder="Max" style="font-size:12px" [(ngModel)]="maxCoupon" name="maxc"/>
            </div>
          </div>

          <div class="filter-section">
            <div class="filter-label">Maturity</div>
            @for (m of maturities; track m.label) {
              <label class="filter-check">
                <input type="checkbox" [checked]="m.checked" (change)="m.checked = !m.checked" style="accent-color:var(--accent-cyan)"/> {{ m.label }}
              </label>
            }
          </div>

          <div class="filter-section">
            <div class="filter-label">Rating</div>
            <div class="rating-chips">
              @for (r of ratings; track r) {
                <span class="chip" [class.active]="activeRatings().includes(r)" (click)="toggleRating(r)">{{ r }}</span>
              }
            </div>
          </div>

          <button class="btn btn-secondary" style="width:100%;justify-content:center;margin-top:8px">
            <span class="material-icons-round">refresh</span> Reset Filters
          </button>
        </aside>

        <!-- Main Content -->
        <div class="bonds-content">
          <!-- Search + Sort -->
          <div class="content-toolbar">
            <div class="search-bar" style="flex:1">
              <span class="material-icons-round search-icon">search</span>
              <input class="form-control" style="width:100%;padding-left:36px" placeholder="Search by name, ISIN, issuer..." [(ngModel)]="searchTerm" name="bs"/>
            </div>
            <select class="form-control form-select" style="width:180px" [(ngModel)]="sortBy" name="sb">
              <option value="yield">Sort: Yield ↓</option>
              <option value="price">Sort: Price ↓</option>
              <option value="maturity">Sort: Maturity</option>
              <option value="coupon">Sort: Coupon ↓</option>
            </select>
          </div>

          <!-- Table View -->
          @if (viewMode() === 'table') {
            <div class="card" style="padding:0;overflow:hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" style="accent-color:var(--accent-cyan)"/></th>
                    <th>Bond Name</th>
                    <th>ISIN</th>
                    <th>Rating</th>
                    <th>Coupon</th>
                    <th>Maturity</th>
                    <th>Price</th>
                    <th>YTM</th>
                    <th>Volume</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (bond of filteredBonds(); track bond.isin) {
                    <tr (click)="selectedBond.set(bond)">
                      <td (click)="$event.stopPropagation()">
                        <input type="checkbox" style="accent-color:var(--accent-cyan)" [checked]="compareList().includes(bond.isin)" (change)="toggleCompare(bond.isin)"/>
                      </td>
                      <td>
                        <div class="bond-name-cell">
                          <span class="bond-type-dot" [style.background]="bond.typeColor"></span>
                          <div>
                            <strong>{{ bond.name }}</strong>
                            <small>{{ bond.issuer }}</small>
                          </div>
                        </div>
                      </td>
                      <td><code style="font-size:11px;color:var(--accent-cyan)">{{ bond.isin }}</code></td>
                      <td><span class="rating-badge" [ngClass]="ratingClass(bond.rating)">{{ bond.rating }}</span></td>
                      <td class="text-cyan" style="font-weight:600">{{ bond.coupon }}%</td>
                      <td style="color:var(--text-secondary)">{{ bond.maturity }}</td>
                      <td style="font-weight:600">{{ bond.price }}</td>
                      <td [style.color]="bond.ytm > 4 ? 'var(--success)' : 'var(--warning)'">{{ bond.ytm }}%</td>
                      <td style="color:var(--text-secondary)">SAR {{ bond.volume }}</td>
                      <td (click)="$event.stopPropagation()">
                        <div style="display:flex;gap:6px">
                          <button class="btn btn-success btn-sm">Buy</button>
                          <button class="btn btn-secondary btn-sm">Details</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Grid View -->
          @if (viewMode() === 'grid') {
            <div class="bonds-grid">
              @for (bond of filteredBonds(); track bond.isin) {
                <div class="bond-card" (click)="selectedBond.set(bond)">
                  <div class="bond-card-header">
                    <span class="bond-type-label" [style.background]="bond.typeColor + '22'" [style.color]="bond.typeColor">{{ bond.type }}</span>
                    <span class="rating-badge" [ngClass]="ratingClass(bond.rating)">{{ bond.rating }}</span>
                  </div>
                  <h4 style="font-size:13px;margin:10px 0 4px">{{ bond.name }}</h4>
                  <p style="font-size:11px;color:var(--text-secondary);margin-bottom:14px">{{ bond.issuer }}</p>
                  <div class="bond-card-stats">
                    <div class="bc-stat"><div class="bc-label">Coupon</div><div class="bc-val text-cyan">{{ bond.coupon }}%</div></div>
                    <div class="bc-stat"><div class="bc-label">YTM</div><div class="bc-val" [style.color]="bond.ytm > 4 ? 'var(--success)' : 'var(--warning)'">{{ bond.ytm }}%</div></div>
                    <div class="bc-stat"><div class="bc-label">Price</div><div class="bc-val">{{ bond.price }}</div></div>
                  </div>
                  <div class="bond-card-footer">
                    <span style="font-size:11px;color:var(--text-muted)">{{ bond.maturity }}</span>
                    <button class="btn btn-success btn-sm" (click)="$event.stopPropagation()">Buy</button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Pagination -->
          <div class="table-footer" style="margin-top:16px">
            <span class="text-muted">Showing {{ filteredBonds().length }} of {{ bonds.length }} bonds</span>
            <div class="pagination">
              @for (p of [1,2,3,4,5]; track p) {
                <button class="btn btn-secondary btn-sm" [class.active]="p === 1">{{ p }}</button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .marketplace-layout { display: grid; grid-template-columns: 220px 1fr; gap: 20px; }

    .filter-sidebar { padding: 20px; height: fit-content; }

    .filter-section { margin-bottom: 20px; }

    .filter-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }

    .filter-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); cursor: pointer; margin-bottom: 6px; }

    .range-inputs { display: flex; align-items: center; gap: 8px; }

    .rating-chips { display: flex; flex-wrap: wrap; gap: 6px; }

    .content-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }

    .bond-name-cell { display: flex; align-items: center; gap: 10px; strong { display: block; font-size: 13px; } small { font-size: 11px; color: var(--text-secondary); } }

    .bond-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

    .rating-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .rating-aaa { background: rgba(46,213,115,0.15); color: var(--success); }
    .rating-aa  { background: rgba(0,212,255,0.15);  color: var(--accent-cyan); }
    .rating-a   { background: rgba(23,195,178,0.15); color: var(--accent-teal); }
    .rating-bbb { background: rgba(255,193,7,0.15);  color: var(--warning); }
    .rating-bb  { background: rgba(255,71,87,0.15);  color: var(--danger); }

    .bonds-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }

    .bond-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 16px; cursor: pointer; transition: all 0.2s;
      &:hover { border-color: var(--accent-cyan); transform: translateY(-2px); }
    }

    .bond-card-header { display: flex; align-items: center; justify-content: space-between; }

    .bond-type-label { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }

    .bond-card-stats { display: flex; gap: 16px; margin-bottom: 12px; }

    .bc-stat { display: flex; flex-direction: column; gap: 2px; }
    .bc-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .bc-val { font-size: 15px; font-weight: 700; }

    .bond-card-footer { display: flex; align-items: center; justify-content: space-between; }

    .table-footer { display: flex; align-items: center; justify-content: space-between; }

    .pagination { display: flex; gap: 6px; }

    .btn.active { background: rgba(0,212,255,0.1); color: var(--accent-cyan); border-color: var(--accent-cyan); }
    .maturities { }
  `],
})
export class BondMarketplaceComponent {
  viewMode = signal<'table' | 'grid'>('table');
  searchTerm = '';
  sortBy = 'yield';
  minCoupon = null;
  maxCoupon = null;
  selectedBond = signal<any>(null);
  compareList = signal<string[]>([]);
  activeRatings = signal<string[]>([]);

  bondTypes = ['Government', 'Corporate', 'Sukuk', 'Municipal', 'Supranational'];
  regions = ['Saudi Arabia', 'UAE', 'Kuwait', 'Bahrain', 'Qatar', 'Oman', 'International'];
  ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'];
  maturities = [
    { label: '< 1 year', checked: true },
    { label: '1-3 years', checked: true },
    { label: '3-5 years', checked: true },
    { label: '5-10 years', checked: true },
    { label: '> 10 years', checked: false },
  ];

  marketStats = [
    { label: 'Total Bonds Listed', value: '1,847', chg: '24 new', up: true },
    { label: 'Market Cap', value: 'SAR 892B', chg: '2.4%', up: true },
    { label: 'Avg YTM', value: '4.85%', chg: '0.12%', up: false },
    { label: 'Trading Volume', value: 'SAR 2.8B', chg: '15.3%', up: true },
  ];

  bonds = [
    { name: 'Saudi Govt. Bond 2029', issuer: 'Ministry of Finance, KSA', isin: 'SA1230001234', type: 'Government', typeColor: '#00d4ff', rating: 'AAA', coupon: 4.25, maturity: 'Mar 2029', price: '101.45', ytm: 3.98, volume: '1.2B' },
    { name: 'Saudi Aramco Sukuk 2026', issuer: 'Saudi Aramco', isin: 'SA2340015678', type: 'Sukuk', typeColor: '#17c3b2', rating: 'AA+', coupon: 3.75, maturity: 'Jun 2026', price: '99.82', ytm: 3.83, volume: '850M' },
    { name: 'SABIC Corporate Bond 2028', issuer: 'Saudi Basic Industries Corp', isin: 'SA3450029012', type: 'Corporate', typeColor: '#7c4dff', rating: 'AA', coupon: 4.50, maturity: 'Dec 2028', price: '100.75', ytm: 4.34, volume: '420M' },
    { name: 'Abu Dhabi Govt. Bond 2030', issuer: 'Emirate of Abu Dhabi', isin: 'AE0040012345', type: 'Government', typeColor: '#00d4ff', rating: 'AA', coupon: 3.90, maturity: 'Sep 2030', price: '98.60', ytm: 4.12, volume: '980M' },
    { name: 'Kuwait Finance House Sukuk', issuer: 'Kuwait Finance House', isin: 'KW0050023456', type: 'Sukuk', typeColor: '#17c3b2', rating: 'A+', coupon: 5.00, maturity: 'Jan 2027', price: '102.10', ytm: 4.52, volume: '310M' },
    { name: 'Qatar National Bank Bond', issuer: 'QNB Group', isin: 'QA0060034567', type: 'Corporate', typeColor: '#7c4dff', rating: 'AA-', coupon: 4.75, maturity: 'Aug 2027', price: '101.25', ytm: 4.41, volume: '560M' },
    { name: 'NCB Capital Sukuk 2025', issuer: 'NCB Capital', isin: 'SA0070045678', type: 'Sukuk', typeColor: '#17c3b2', rating: 'AA', coupon: 3.50, maturity: 'Oct 2025', price: '99.95', ytm: 3.52, volume: '200M' },
    { name: 'ADNOC Green Bond 2032', issuer: 'Abu Dhabi National Oil Co', isin: 'AE0080056789', type: 'Corporate', typeColor: '#7c4dff', rating: 'AA+', coupon: 4.10, maturity: 'May 2032', price: '97.80', ytm: 4.48, volume: '750M' },
  ];

  filteredBonds() {
    return this.bonds.filter(b =>
      b.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      b.isin.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      b.issuer.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  toggleCompare(isin: string) {
    const list = [...this.compareList()];
    const idx = list.indexOf(isin);
    if (idx >= 0) list.splice(idx, 1);
    else if (list.length < 4) list.push(isin);
    this.compareList.set(list);
  }

  toggleRating(r: string) {
    const list = [...this.activeRatings()];
    const idx = list.indexOf(r);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(r);
    this.activeRatings.set(list);
  }

  ratingClass(r: string) {
    if (r.startsWith('AAA')) return 'rating-aaa';
    if (r.startsWith('AA')) return 'rating-aa';
    if (r.startsWith('A')) return 'rating-a';
    if (r.startsWith('BBB')) return 'rating-bbb';
    return 'rating-bb';
  }
}
