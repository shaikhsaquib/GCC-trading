namespace GccBond.Shared.Interfaces;

/// <summary>Generic repository base contract.</summary>
public interface IRepository<TModel, TKey>
{
    Task<TModel?> GetByIdAsync(TKey id);
    Task<IEnumerable<TModel>> GetAllAsync(int limit = 50, int offset = 0);
    Task<TKey> CreateAsync(TModel model);
    Task UpdateAsync(TModel model);
    Task DeleteAsync(TKey id);
}
