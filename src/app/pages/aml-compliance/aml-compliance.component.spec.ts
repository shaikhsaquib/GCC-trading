import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmlComplianceComponent } from './aml-compliance.component';

describe('AmlComplianceComponent', () => {
  let component: AmlComplianceComponent;
  let fixture: ComponentFixture<AmlComplianceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmlComplianceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmlComplianceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
