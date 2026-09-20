// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IOracle
 * @notice The only thing the engine knows about prices.
 *
 * One method, one number, scaled to 1e18 whatever the source's own exponent
 * is. Implementations revert rather than return a stale or invalid price: a
 * perp engine that trades on a price it cannot vouch for is worse than one
 * that refuses the trade.
 */
interface IOracle {
    /// @param market The engine's market id (e.g. keccak256("USDJPY")).
    /// @return price The mark, scaled to 1e18. Reverts if unknown or stale.
    function price(bytes32 market) external view returns (uint256);

    /// @return True when the oracle can currently price this market.
    function hasFeed(bytes32 market) external view returns (bool);
}
