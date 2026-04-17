namespace GccBond.Shared.Models;

/// <summary>Computed bond math metrics — not persisted, calculated on-the-fly.</summary>
public record BondMetrics
{
    public decimal Ytm              { get; init; }
    public decimal CurrentYield     { get; init; }
    public decimal ModifiedDuration { get; init; }
    public decimal AccruedInterest  { get; init; }
    public decimal DirtyPrice       { get; init; }
}
