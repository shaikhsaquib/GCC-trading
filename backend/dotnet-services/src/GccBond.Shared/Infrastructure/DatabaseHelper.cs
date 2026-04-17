using System.Data;
using Dapper;
using Npgsql;

namespace GccBond.Shared.Infrastructure;

/// <summary>
/// Thin wrapper over Dapper + Npgsql with transaction support and connection pooling.
/// </summary>
public class DatabaseHelper
{
    private readonly string _connectionString;

    public DatabaseHelper(string connectionString) => _connectionString = connectionString;

    public NpgsqlConnection CreateConnection() => new(_connectionString);

    public async Task<IEnumerable<T>> QueryAsync<T>(string sql, object? param = null)
    {
        await using var conn = CreateConnection();
        return await conn.QueryAsync<T>(sql, param);
    }

    public async Task<T?> QueryFirstOrDefaultAsync<T>(string sql, object? param = null)
    {
        await using var conn = CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    public async Task<int> ExecuteAsync(string sql, object? param = null)
    {
        await using var conn = CreateConnection();
        return await conn.ExecuteAsync(sql, param);
    }

    public async Task<T?> ExecuteScalarAsync<T>(string sql, object? param = null)
    {
        await using var conn = CreateConnection();
        return await conn.ExecuteScalarAsync<T>(sql, param);
    }

    /// <summary>ACID transaction — commits on success, rolls back on exception.</summary>
    public async Task TransactionAsync(Func<IDbConnection, IDbTransaction, Task> work)
    {
        await using var conn = CreateConnection();
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            await work(conn, tx);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    /// <summary>ACID transaction with result.</summary>
    public async Task<T> TransactionAsync<T>(Func<IDbConnection, IDbTransaction, Task<T>> work)
    {
        await using var conn = CreateConnection();
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var result = await work(conn, tx);
            await tx.CommitAsync();
            return result;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> HealthCheckAsync()
    {
        try
        {
            await using var conn = CreateConnection();
            var result = await conn.ExecuteScalarAsync<int>("SELECT 1");
            return result == 1;
        }
        catch { return false; }
    }
}
