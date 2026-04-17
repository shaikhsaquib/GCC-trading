namespace GccBond.Shared.Exceptions;

public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message = "Unauthorized")
        : base(message, "UNAUTHORIZED", 401) { }
}
