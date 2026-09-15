namespace GccBond.Shared.Constants;

/// <summary>
/// User role identifiers — single source of truth for the .NET services.
/// These match the DB CHECK constraint on app_auth.users.role and the "role"
/// claim in the JWT issued by the gateway.
/// </summary>
public static class Roles
{
    public const string Investor   = "INVESTOR";
    public const string KycOfficer = "KYC_OFFICER";
    public const string L2Admin    = "L2_ADMIN";
    public const string Admin      = "ADMIN";
    public const string Compliance = "COMPLIANCE";

    /// <summary>Roles granted admin / back-office access.</summary>
    public static readonly string[] AdminRoles = { Admin, L2Admin, Compliance, KycOfficer };
}
