import { BondsRepository, BondSearchFilter } from './bonds.repository';
import { PagedBondResponse, Bond } from './bonds.types';

export class BondsService {
  constructor(private readonly repo: BondsRepository) {}

  async search(filter: BondSearchFilter): Promise<PagedBondResponse> {
    const { items, total } = await this.repo.search(filter);
    return {
      items,
      totalCount: total,
      page:       filter.page,
      pageSize:   filter.pageSize,
    };
  }

  async getById(id: string): Promise<Bond | null> {
    return this.repo.findById(id);
  }
}
