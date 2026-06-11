import { Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';

/**
 * Animates the host element's text from the previously displayed number
 * to the new target value (~800ms, easeOutCubic).
 *
 * Usage:
 *   <div [appCountUp]="1234567" countUpPrefix="SAR " [countUpDecimals]="2"></div>
 *   <div [appCountUp]="aum" [countUpCompact]="true"></div>
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) appCountUp = 0;
  @Input() countUpPrefix   = '';
  @Input() countUpSuffix   = '';
  @Input() countUpDecimals = 0;
  @Input() countUpCompact  = false;

  private readonly el = inject(ElementRef<HTMLElement>);

  private current = 0;
  private rafId: number | null = null;

  private static readonly DURATION_MS = 800;

  ngOnChanges(changes: SimpleChanges) {
    const target = Number(this.appCountUp) || 0;

    if (!changes['appCountUp']) {
      // Only formatting inputs changed — re-render the current value.
      this.render(this.current);
      return;
    }

    this.cancelAnimation();

    if (this.prefersReducedMotion()) {
      this.current = target;
      this.render(target);
      return;
    }

    const from = changes['appCountUp'].firstChange ? 0 : this.current;
    this.animate(from, target);
  }

  ngOnDestroy() {
    this.cancelAnimation();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private animate(from: number, to: number) {
    const start = performance.now();

    const step = (now: number) => {
      const t     = Math.min(1, (now - start) / CountUpDirective.DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.current = from + (to - from) * eased;
      this.render(this.current);
      if (t < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId   = null;
        this.current = to;
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  private render(value: number) {
    const formatter = this.countUpCompact
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
      : new Intl.NumberFormat('en-US', {
          minimumFractionDigits: this.countUpDecimals,
          maximumFractionDigits: this.countUpDecimals,
        });
    this.el.nativeElement.textContent =
      `${this.countUpPrefix}${formatter.format(value)}${this.countUpSuffix}`;
  }

  private cancelAnimation() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
