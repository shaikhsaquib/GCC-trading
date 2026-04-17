namespace GccBond.Shared.Exceptions;

/// <summary>Base class for all domain-specific exceptions.</summary>
public abstract class DomainException : Exception
{
    public string Code        { get; }
    public int    StatusCode  { get; }

    protected DomainException(string message, string code, int statusCode)
        : base(message)
    {
        Code       = code;
        StatusCode = statusCode;
    }
}
