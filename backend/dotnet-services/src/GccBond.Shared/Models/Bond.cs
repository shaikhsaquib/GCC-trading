namespace GccBond.Shared.Models;

// ── Enums ────────────────────────────────────────────────────────────────────

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

// ── Bond Listing — FSD §6.5 ───────────────────────────────────────────────────

public record BondListing
{
    public Guid     Id                 { get; init; }
    public string   Isin               { get; init; } = "";
    public string   Name               { get; init; } = "";
    public string   IssuerName         { get; init; } = "";
    public IssuerType IssuerType       { get; init; }
    public string   Currency           { get; init; } = "AED";
    public decimal  FaceValue          { get; init; }
    public decimal  CouponRate         { get; init; }
    public CouponFrequency CouponFrequency { get; init; }
    public DateOnly MaturityDate       { get; init; }
    public string?  CreditRating       { get; init; }
    public bool     IsShariaCompliant  { get; init; }
    public decimal  MinInvestment      { get; init; }
    public decimal  CurrentPrice       { get; init; }
    public BondStatus Status           { get; init; }
    public DateTime CreatedAt          { get; init; }
    public DateTime UpdatedAt          { get; init; }
}

// ── Order — FSD §6.4 ─────────────────────────────────────────────────────────

public record Order
{
    public Guid        Id              { get; init; }
    public Guid        UserId          { get; init; }
    public Guid        BondId          { get; init; }
    public OrderSide   Side            { get; init; }
    public OrderType   OrderType       { get; init; }
    public decimal     Quantity        { get; init; }
    public decimal     FilledQuantity  { get; set; }
    public decimal?    Price           { get; init; }
    public decimal?    AvgFillPrice    { get; set; }
    public OrderStatus Status          { get; set; }
    public DateTime?   ExpiresAt       { get; init; }
    public string?     CancelReason    { get; set; }
    public string      IdempotencyKey  { get; init; } = "";
    public DateTime    CreatedAt       { get; init; }
    public DateTime    UpdatedAt       { get; set; }
}

// ── Trade (matched order pair) ────────────────────────────────────────────────

public record Trade
{
    public Guid     Id              { get; init; }
    public Guid     BuyOrderId      { get; init; }
    public Guid     SellOrderId     { get; init; }
    public Guid     BuyerId         { get; init; }
    public Guid     SellerId        { get; init; }
    public Guid     BondId          { get; init; }
    public decimal  Quantity        { get; init; }
    public decimal  Price           { get; init; }
    public decimal  BuyerFee        { get; init; }
    public decimal  SellerFee       { get; init; }
    public decimal  SettlementFee   { get; init; }
    public DateTime ExecutedAt      { get; init; }
}

// ── Settlement ────────────────────────────────────────────────────────────────

public record Settlement
{
    public Guid             Id             { get; init; }
    public Guid             TradeId        { get; init; }
    public SettlementStatus Status         { get; set; }
    public DateTime         TradeDate      { get; init; }
    public DateTime         SettlementDate { get; init; }
    public int              RetryCount     { get; set; }
    public string?          FailureReason  { get; set; }
    public DateTime         CreatedAt      { get; init; }
    public DateTime         UpdatedAt      { get; set; }
}

// ── Portfolio Holding ─────────────────────────────────────────────────────────

public record PortfolioHolding
{
    public Guid     Id              { get; init; }
    public Guid     UserId          { get; init; }
    public Guid     BondId          { get; init; }
    public decimal  Quantity        { get; init; }
    public decimal  AvgBuyPrice     { get; init; }
    public decimal  CurrentValue    { get; init; }
    public decimal  UnrealizedPnl   { get; init; }
    public decimal  TotalCouponReceived { get; init; }
    public DateTime UpdatedAt       { get; init; }
}

// ── Bond Math Results ─────────────────────────────────────────────────────────

public record BondMetrics
{
    public decimal Ytm             { get; init; }
    public decimal CurrentYield    { get; init; }
    public decimal ModifiedDuration{ get; init; }
    public decimal AccruedInterest { get; init; }
    public decimal DirtyPrice      { get; init; }
}
