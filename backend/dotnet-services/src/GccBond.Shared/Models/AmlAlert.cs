namespace GccBond.Shared.Models;

/// <summary>AML alert domain model — maps to aml.alerts table (FSD §15).</summary>
public record AmlAlert
{
    public Guid          Id          { get; init; }
    public Guid          UserId      { get; init; }
    public string        RuleCode    { get; init; } = "";
    public string        Description { get; init; } = "";
    public AlertSeverity Severity    { get; init; }
    public AlertStatus   Status      { get; set; }
    public decimal       Amount      { get; init; }
    public string        Currency    { get; init; } = "AED";
    public string?       SarRef      { get; set; }
    public DateTime      CreatedAt   { get; init; }
    public DateTime      UpdatedAt   { get; set; }
}
