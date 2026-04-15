import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BondMarketplaceComponent } from './bond-marketplace.component';

describe('BondMarketplaceComponent', () => {
  let component: BondMarketplaceComponent;
  let fixture: ComponentFixture<BondMarketplaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BondMarketplaceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BondMarketplaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
