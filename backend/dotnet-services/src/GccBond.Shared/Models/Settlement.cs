namespace GccBond.Shared.Models;

/// <summary>Settlement domain model — maps to settlement.settlements table (FSD §6.6).</summary>
public record Settlement
{
    public Guid             Id             { get; init; }
    public Guid             TradeId        { get; init; }
    public SettlementStatus Status         { get; set; }
    public DateTime         TradeDate      { get; init; }
    public DateTime         SettlementDate { get; init; }
    public int              RetryCount     { get; set; }
    public string?          FailureReason  { get; set; }
    public DateTime         CreatedAt      { get; init; }
    public DateTime         UpdatedAt      { get; set; }
}
