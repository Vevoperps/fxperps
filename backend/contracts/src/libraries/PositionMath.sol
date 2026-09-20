// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PositionMath
 * @notice Every number the ticket prints, as pure arithmetic.
 *
 * The site, the handbook and the engine have to agree to the last decimal or
 * one of them is lying, so all three read from this one definition:
 *
 *   notional     = margin x leverage
 *   pnl          = notional x (mark - entry) / entry, signed by side
 *   equity       = margin + pnl - accrued funding
 *   maintenance  = 0.5% of notional
 *   liquidation  = the mark at which equity falls to maintenance
 *   payout       = margin + pnl - funding - exit fee, capped at 10x margin
 *
 * Amounts are all in the settlement token's own units. Because a pnl is a
 * notional scaled by a ratio of two prices, the price scale cancels and the
 * token's decimals never enter the arithmetic.
 */
library PositionMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;

    /// @notice Charged on notional, each way.
    uint256 internal constant FEE_BPS = 5; // 0.05%
    /// @notice The floor equity is measured against, as a share of notional.
    uint256 internal constant MAINTENANCE_BPS = 50; // 0.5%
    /// @notice The most a position can return, as a multiple of its margin.
    uint256 internal constant PAYOUT_CAP = 10;

    /// @notice The result of the move, before costs.
    function pnl(uint256 notional, uint256 entryPrice, uint256 markPrice, bool isLong)
        internal
        pure
        returns (int256)
    {
        if (entryPrice == 0) return 0;

        int256 move = int256(markPrice) - int256(entryPrice);
        int256 gross = (int256(notional) * move) / int256(entryPrice);
        return isLong ? gross : -gross;
    }

    /// @notice 0.05% of the notional being opened or closed.
    function fee(uint256 notional) internal pure returns (uint256) {
        return (notional * FEE_BPS) / BPS;
    }

    /// @notice What is left when a position closes itself: 0.5% of notional.
    function maintenance(uint256 notional) internal pure returns (uint256) {
        return (notional * MAINTENANCE_BPS) / BPS;
    }

    /// @notice Margin plus the unrealised result, less funding accrued against it.
    function equity(uint256 margin, int256 positionPnl, int256 accruedFunding) internal pure returns (int256) {
        return int256(margin) + positionPnl - accruedFunding;
    }

    /**
     * @notice The mark at which equity falls to the maintenance margin.
     *
     * Solving `margin + notional (P - E)/E s - funding = maintenance` for P,
     * with `s` +1 long and -1 short. At 10x with no funding this lands 9.5%
     * from the entry, and at 25x, 3.5% — the two distances the handbook
     * quotes.
     */
    function liquidationPrice(
        uint256 margin,
        uint256 notional,
        uint256 entryPrice,
        int256 accruedFunding,
        bool isLong
    ) internal pure returns (uint256) {
        if (notional == 0 || entryPrice == 0) return 0;

        int256 shortfall = int256(maintenance(notional)) + accruedFunding - int256(margin);
        int256 ratio = (shortfall * int256(WAD)) / int256(notional);
        int256 delta = isLong ? ratio : -ratio;

        int256 price = (int256(entryPrice) * (int256(WAD) + delta)) / int256(WAD);
        return price > 0 ? uint256(price) : 0;
    }

    /**
     * @notice What actually lands back in the free balance on close.
     *
     * Floored at zero, because a position cannot hand back a negative number,
     * and capped, because that is the promise on the ticket and the reason the
     * pool can back it rather than promise it.
     *
     * The cap is passed in rather than derived from the margin, because a
     * partial close takes its share of a cap that was fixed when the position
     * opened — and the margin behind it may have been topped up since, which
     * deliberately does not raise the cap.
     */
    function payout(uint256 margin, int256 positionPnl, int256 accruedFunding, uint256 exitFee, uint256 cap)
        internal
        pure
        returns (uint256)
    {
        int256 net = int256(margin) + positionPnl - accruedFunding - int256(exitFee);
        if (net <= 0) return 0;

        return uint256(net) > cap ? cap : uint256(net);
    }
}
