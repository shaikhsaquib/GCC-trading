using GccBond.Shared.Models;
using SettlementModel = GccBond.Shared.Models.Settlement;

namespace GccBond.Settlement.DTOs;

public record SettlementResponse
{
    public Guid     Id             { get; init; }
    public Guid     TradeId        { get; init; }
    public string   Status         { get; init; } = "";
    public DateTime TradeDate      { get; init; }
    public DateTime SettlementDate { get; init; }
    public int      RetryCount     { get; init; }
    public string?  FailureReason  { get; init; }
    public DateTime CreatedAt      { get; init; }

    public static SettlementResponse FromModel(SettlementModel s) => new()
    {
        Id             = s.Id,
        TradeId        = s.TradeId,
        Status         = s.Status.ToString(),
        TradeDate      = s.TradeDate,
        SettlementDate = s.SettlementDate,
        RetryCount     = s.RetryCount,
        FailureReason  = s.FailureReason,
        CreatedAt      = s.CreatedAt,
    };
}
