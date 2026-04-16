namespace GccBond.Shared.Exceptions;

public class NotFoundException : DomainException
{
    public NotFoundException(string resource)
        : base($"{resource} not found", "NOT_FOUND", 404) { }
}
