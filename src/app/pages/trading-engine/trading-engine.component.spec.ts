import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradingEngineComponent } from './trading-engine.component';

describe('TradingEngineComponent', () => {
  let component: TradingEngineComponent;
  let fixture: ComponentFixture<TradingEngineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradingEngineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TradingEngineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
