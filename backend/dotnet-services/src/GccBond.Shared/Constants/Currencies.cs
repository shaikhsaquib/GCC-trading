namespace GccBond.Shared.Constants;

/// <summary>
/// Currency codes — single source of truth. AED is the platform's base/account
/// currency (matches the DB default and wallet). The supported set mirrors the
/// DB CHECK constraint on preferred_currency.
/// </summary>
public static class Currencies
{
    public const string Default = "AED";

    public static readonly string[] Supported =
        { "AED", "SAR", "KWD", "QAR", "OMR", "BHD", "USD" };
}
