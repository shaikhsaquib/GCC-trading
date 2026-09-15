namespace GccBond.Shared.Constants;

/// <summary>
/// KYC risk tiers and their per-order investment limits (in AED) — single
/// source of truth. Keeps the tier limits used by the order risk-check in one
/// place instead of magic numbers scattered across services.
/// </summary>
public static class RiskTiers
{
    public const string Low    = "LOW";
    public const string Medium = "MEDIUM";
    public const string High   = "HIGH";

    public const decimal LowLimitAed    = 10_000m;
    public const decimal MediumLimitAed = 50_000m;
    public const decimal HighLimitAed   = 200_000m;

    /// <summary>Per-order investment limit for a tier (defaults to LOW if unknown/null).</summary>
    public static decimal LimitFor(string? tier) => tier switch
    {
        High   => HighLimitAed,
        Medium => MediumLimitAed,
        _      => LowLimitAed,
    };
}
