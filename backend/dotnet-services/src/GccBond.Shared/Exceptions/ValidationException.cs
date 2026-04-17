namespace GccBond.Shared.Exceptions;

public class ValidationException : DomainException
{
    public IEnumerable<string> Errors { get; }

    public ValidationException(IEnumerable<string> errors)
        : base("Validation failed", "VALIDATION_ERROR", 400)
    {
        Errors = errors;
    }

    public ValidationException(string error)
        : this(new[] { error }) { }
}
