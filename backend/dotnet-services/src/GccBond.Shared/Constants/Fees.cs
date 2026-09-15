namespace GccBond.Shared.Constants;

/// <summary>
/// Settlement fee schedule — single source of truth for the authoritative
/// charges applied when a trade settles. Expressed as fractions of notional
/// (basis points ÷ 10,000).
/// </summary>
public static class Fees
{
    /// <summary>Buyer commission — 25 bps (0.25%).</summary>
    public const decimal BuyerBps = 0.0025m;

    /// <summary>Seller commission — 25 bps (0.25%).</summary>
    public const decimal SellerBps = 0.0025m;

    /// <summary>Settlement fee — 10 bps (0.10%).</summary>
    public const decimal SettlementBps = 0.001m;
}
