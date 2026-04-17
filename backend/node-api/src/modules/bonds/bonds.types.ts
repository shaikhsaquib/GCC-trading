export interface Bond {
  id:                string;
  isin:              string;
  name:              string;
  issuerName:        string;
  issuerType:        'Government' | 'Corporate';
  currency:          string;
  faceValue:         number;
  couponRate:        number;
  couponFrequency:   'Annual' | 'SemiAnnual' | 'Quarterly';
  maturityDate:      string;
  creditRating:      string;
  isShariaCompliant: boolean;
  minInvestment:     number;
  currentPrice:      number;
  status:            'Active' | 'Delisted' | 'Matured';
}

export interface PagedBondResponse {
  items:      Bond[];
  totalCount: number;
  page:       number;
  pageSize:   number;
}
