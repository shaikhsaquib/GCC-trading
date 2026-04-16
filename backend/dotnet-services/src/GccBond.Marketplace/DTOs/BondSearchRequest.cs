namespace GccBond.Marketplace.DTOs;

public record BondSearchRequest
{
    public string? Search          { get; init; }
    public string? IssuerType      { get; init; }
    public bool?   ShariaCompliant { get; init; }
    public string? Currency        { get; init; }
    public string  SortBy          { get; init; } = "created_at";
    public string  SortDir         { get; init; } = "DESC";
    public int     Limit           { get; init; } = 20;
    public int     Offset          { get; init; } = 0;
}
