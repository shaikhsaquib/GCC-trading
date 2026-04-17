namespace GccBond.Shared.DTOs;

/// <summary>Standard API response envelope used by all services.</summary>
public record ApiResponse<T>
{
    public bool   Success   { get; init; }
    public T?     Data      { get; init; }
    public string? Error    { get; init; }
    public string  RequestId{ get; init; } = "";
    public string  Timestamp{ get; init; } = DateTime.UtcNow.ToString("o");

    public static ApiResponse<T> Ok(T data, string requestId = "")
        => new() { Success = true, Data = data, RequestId = requestId };

    public static ApiResponse<T> Fail(string error, string requestId = "")
        => new() { Success = false, Error = error, RequestId = requestId };
}

public record PagedResponse<T>
{
    public IEnumerable<T> Items  { get; init; } = [];
    public int            Total  { get; init; }
    public int            Limit  { get; init; }
    public int            Offset { get; init; }
    public bool           HasMore => Offset + Limit < Total;
}
