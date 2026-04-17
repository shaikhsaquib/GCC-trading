using GccBond.Shared.Models;

namespace GccBond.Trading.Interfaces;

public interface IMatchingEngine
{
    Task MatchAsync(Order incomingOrder);
}
