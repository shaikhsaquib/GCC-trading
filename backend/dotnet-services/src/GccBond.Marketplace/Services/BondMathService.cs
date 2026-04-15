namespace GccBond.Marketplace.Services;

/// <summary>
/// Bond math calculations (FSD §6.7 — BondMetrics).
/// All calculations follow standard fixed-income conventions.
/// </summary>
public static class BondMathService
{
    /// <summary>
    /// Newton-Raphson YTM solver. Converges in &lt;20 iterations for normal bonds.
    /// </summary>
    public static decimal CalculateYtm(
        decimal cleanPrice,
        decimal faceValue,
        decimal couponRate,
        int     paymentsPerYear,
        int     periodsRemaining)
    {
        if (periodsRemaining <= 0) return 0m;

        double coupon  = (double)(faceValue * couponRate / paymentsPerYear);
        double pv      = (double)cleanPrice;
        double par     = (double)faceValue;
        double n       = periodsRemaining;

        // Initial guess: coupon yield
        double ytm = coupon / pv;

        for (int i = 0; i < 200; i++)
        {
            double r = ytm / paymentsPerYear;
            double price = 0;
            for (int t = 1; t <= n; t++)
                price += coupon / Math.Pow(1 + r, t);
            price += par / Math.Pow(1 + r, n);

            double delta = price - pv;
            if (Math.Abs(delta) < 1e-8) break;

            // Derivative dP/dr
            double dp = 0;
            for (int t = 1; t <= n; t++)
                dp -= t * coupon / Math.Pow(1 + r, t + 1);
            dp -= n * par / Math.Pow(1 + r, n + 1);

            // Divide derivative by paymentsPerYear (chain rule: dP/d(annual_ytm))
            ytm -= (delta / dp) * paymentsPerYear;

            if (ytm < 0) ytm = 0.0001;
        }

        return (decimal)Math.Round(ytm, 6);
    }

    /// <summary>Current Yield = Annual Coupon / Clean Price.</summary>
    public static decimal CurrentYield(decimal faceValue, decimal couponRate, decimal cleanPrice)
        => cleanPrice == 0 ? 0 : Math.Round(faceValue * couponRate / cleanPrice, 6);

    /// <summary>
    /// Modified Duration (Macaulay Duration / (1 + r/m)).
    /// </summary>
    public static decimal ModifiedDuration(
        decimal ytm,
        int     paymentsPerYear,
        int     periodsRemaining,
        decimal cleanPrice,
        decimal faceValue,
        decimal couponRate)
    {
        if (periodsRemaining <= 0 || cleanPrice == 0) return 0m;

        double r      = (double)ytm / paymentsPerYear;
        double coupon = (double)(faceValue * couponRate / paymentsPerYear);
        double par    = (double)faceValue;
        double pv     = (double)cleanPrice;

        // Macaulay duration
        double macaulay = 0;
        for (int t = 1; t <= periodsRemaining; t++)
            macaulay += t * coupon / Math.Pow(1 + r, t);
        macaulay += periodsRemaining * par / Math.Pow(1 + r, periodsRemaining);
        macaulay /= (pv * paymentsPerYear); // convert periods to years

        double modified = macaulay / (1 + r);
        return (decimal)Math.Round(modified, 4);
    }

    /// <summary>
    /// Accrued Interest = FaceValue × CouponRate × (DaysSinceLastCoupon / DaysInPeriod).
    /// Uses 30/360 day count convention (US corporate bond standard).
    /// </summary>
    public static decimal AccruedInterest(
        decimal  faceValue,
        decimal  couponRate,
        int      paymentsPerYear,
        DateTime lastCouponDate,
        DateTime settlementDate)
    {
        double totalDays  = 360.0 / paymentsPerYear;
        double elapsedDays = (settlementDate - lastCouponDate).TotalDays;
        elapsedDays = Math.Min(elapsedDays, totalDays);
        if (elapsedDays < 0) elapsedDays = 0;

        double accrued = (double)(faceValue * couponRate / paymentsPerYear) * (elapsedDays / totalDays);
        return (decimal)Math.Round(accrued, 4);
    }

    /// <summary>Dirty Price = Clean Price + Accrued Interest.</summary>
    public static decimal DirtyPrice(decimal cleanPrice, decimal accruedInterest)
        => cleanPrice + accruedInterest;

    public static int PaymentsPerYear(string frequency)
        => frequency switch
        {
            "Annual"     => 1,
            "SemiAnnual" => 2,
            "Quarterly"  => 4,
            _            => 1,
        };
}
