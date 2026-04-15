export interface DashboardStats {
  totalUsers:       number;
  activeUsers:      number;
  pendingKyc:       number;
  totalBonds:       number;
  openOrders:       number;
  tradesToday:      number;
  tradeVolumeToday: number;
}

export interface UserListFilter {
  status?: string;
  role?:   string;
  search?: string;
  limit?:  number;
  offset?: number;
}
