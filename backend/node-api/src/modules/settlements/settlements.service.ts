import { SettlementsRepository } from './settlements.repository';
import { SettlementListResponse } from './settlements.types';

export class SettlementsService {
  constructor(private readonly repo: SettlementsRepository) {}

  async getAll(params: {
    userId?:  string;
    status?:  string;
    page:     number;
    pageSize: number;
  }): Promise<SettlementListResponse> {
    const [{ items, total }, stats] = await Promise.all([
      this.repo.findAll(params),
      this.repo.getStats(params.userId),
    ]);
    return { items, stats, total };
  }
}
