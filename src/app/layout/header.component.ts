import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { LayoutService } from './layout.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly layout = inject(LayoutService);

  tickers = [
    { symbol: 'SAR/USD', price: '0.2666', change: '0.02%', up: true },
    { symbol: 'BRENT', price: '82.40', change: '1.2%', up: true },
    { symbol: 'TASI', price: '11,842', change: '0.45%', up: false },
    { symbol: 'SUKUK-5Y', price: '98.75', change: '0.12%', up: true },
    { symbol: 'GOV-10Y', price: '4.25%', change: '0.05%', up: false },
  ];
}
