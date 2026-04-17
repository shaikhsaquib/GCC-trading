export interface DashboardStats {
  totalUsers:       number;
  activeUsers:      number;
  pendingKyc:       number;
  totalBonds:       number;
  openOrders:       number;
  tradesToday:      number;
  tradeVolumeToday: number;
  // Extended fields
  totalAum:         number;
  newUsersToday:    number;
  suspendedUsers:   number;
  volumeYesterday:  number;
}

export interface UserListFilter {
  status?: string;
  role?:   string;
  search?: string;
  limit?:  number;
  offset?: number;
}
