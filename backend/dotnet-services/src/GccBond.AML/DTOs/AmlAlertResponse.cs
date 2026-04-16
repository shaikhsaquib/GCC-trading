using GccBond.Shared.Models;

namespace GccBond.AML.DTOs;

public record AmlAlertResponse
{
    public Guid     Id          { get; init; }
    public Guid     UserId      { get; init; }
    public string   RuleCode    { get; init; } = "";
    public string   Description { get; init; } = "";
    public string   Severity    { get; init; } = "";
    public string   Status      { get; init; } = "";
    public decimal  Amount      { get; init; }
    public string   Currency    { get; init; } = "";
    public string?  SarRef      { get; init; }
    public DateTime CreatedAt   { get; init; }

    public static AmlAlertResponse FromModel(AmlAlert a) => new()
    {
        Id          = a.Id,
        UserId      = a.UserId,
        RuleCode    = a.RuleCode,
        Description = a.Description,
        Severity    = a.Severity.ToString(),
        Status      = a.Status.ToString(),
        Amount      = a.Amount,
        Currency    = a.Currency,
        SarRef      = a.SarRef,
        CreatedAt   = a.CreatedAt,
    };
}

public record UpdateAlertRequest
{
    public string  Status { get; init; } = "";
    public string? SarRef { get; init; }
}

public record ScreenRequest
{
    public Guid    UserId        { get; init; }
    public decimal Amount        { get; init; }
    public string  Currency      { get; init; } = "";
    public string  TransactionId { get; init; } = "";
    public string  Type          { get; init; } = "";
}
