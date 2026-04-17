using FluentValidation;
using GccBond.Marketplace.DTOs;

namespace GccBond.Marketplace.Validators;

public class CreateBondRequestValidator : AbstractValidator<CreateBondRequest>
{
    private static readonly string[] ValidIssuerTypes      = ["Government", "Corporate"];
    private static readonly string[] ValidCouponFrequencies= ["Annual", "SemiAnnual", "Quarterly"];
    private static readonly string[] ValidCurrencies       = ["AED", "SAR", "USD", "EUR"];

    public CreateBondRequestValidator()
    {
        RuleFor(x => x.Isin)
            .NotEmpty().Length(12).WithMessage("ISIN must be exactly 12 characters");

        RuleFor(x => x.Name)
            .NotEmpty().MaximumLength(200);

        RuleFor(x => x.IssuerName)
            .NotEmpty().MaximumLength(200);

        RuleFor(x => x.IssuerType)
            .Must(t => ValidIssuerTypes.Contains(t))
            .WithMessage($"IssuerType must be one of: {string.Join(", ", ValidIssuerTypes)}");

        RuleFor(x => x.Currency)
            .Must(c => ValidCurrencies.Contains(c))
            .WithMessage($"Currency must be one of: {string.Join(", ", ValidCurrencies)}");

        RuleFor(x => x.FaceValue)
            .GreaterThan(0).WithMessage("FaceValue must be greater than 0");

        RuleFor(x => x.CouponRate)
            .InclusiveBetween(0, 1).WithMessage("CouponRate must be between 0 and 1 (e.g. 0.05 = 5%)");

        RuleFor(x => x.CouponFrequency)
            .Must(f => ValidCouponFrequencies.Contains(f))
            .WithMessage($"CouponFrequency must be one of: {string.Join(", ", ValidCouponFrequencies)}");

        RuleFor(x => x.MaturityDate)
            .NotEmpty()
            .Must(d => DateOnly.TryParse(d, out var dt) && dt > DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("MaturityDate must be a valid future date (yyyy-MM-dd)");

        RuleFor(x => x.MinInvestment)
            .GreaterThan(0).WithMessage("MinInvestment must be greater than 0");

        RuleFor(x => x.CurrentPrice)
            .GreaterThan(0).WithMessage("CurrentPrice must be greater than 0");
    }
}
