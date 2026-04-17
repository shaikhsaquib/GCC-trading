using FluentValidation;
using GccBond.Shared.Models;
using GccBond.Trading.DTOs;

namespace GccBond.Trading.Validators;

public class PlaceOrderRequestValidator : AbstractValidator<PlaceOrderRequest>
{
    public PlaceOrderRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("UserId is required");

        RuleFor(x => x.BondId)
            .NotEmpty().WithMessage("BondId is required");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Quantity must be greater than 0");

        RuleFor(x => x.Price)
            .GreaterThan(0).When(x => x.Price.HasValue)
            .WithMessage("Price must be greater than 0");

        RuleFor(x => x.Price)
            .NotNull().When(x => x.OrderType == OrderType.Limit)
            .WithMessage("Price is required for limit orders");

        RuleFor(x => x.IdempotencyKey)
            .NotEmpty().WithMessage("IdempotencyKey is required")
            .MaximumLength(100);

        RuleFor(x => x.ExpiresAt)
            .GreaterThan(DateTime.UtcNow).When(x => x.ExpiresAt.HasValue)
            .WithMessage("ExpiresAt must be in the future");
    }
}
