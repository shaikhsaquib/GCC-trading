namespace GccBond.Shared.Models;

public enum BondStatus      { Active, Delisted, Matured }
public enum IssuerType      { Government, Corporate }
public enum CouponFrequency { Annual, SemiAnnual, Quarterly }
public enum OrderSide       { Buy, Sell }
public enum OrderType       { Market, Limit }
public enum OrderStatus
{
    PendingValidation, Validated, Rejected, Open,
    PartiallyFilled, Filled, Cancelled, Expired,
    PendingSettlement, Settled, SettlementFailed,
}
public enum SettlementStatus { Pending, Processing, Reconciling, Completed, Failed }
public enum AlertSeverity    { Low, Medium, High, Critical }
public enum AlertStatus      { Open, UnderReview, Escalated, Cleared, SarFiled }
