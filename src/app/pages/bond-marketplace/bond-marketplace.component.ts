import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bond-marketplace',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './bond-marketplace.component.html',
  styleUrl: './bond-marketplace.component.css',
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
