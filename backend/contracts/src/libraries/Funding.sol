// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Funding
 * @notice The payment that keeps a contract with no expiry tied to the rate.
 *
 * The published rule, and the one implemented here:
 *
 *  - funding is charged on **notional**, not on margin;
 *  - its sign is decided by **skew** — the crowded side pays, the thin side
 *    is paid;
 *  - its magnitude is `|skew| / skewScale` of the cap, and it **stops** at
 *    0.75% per 8h however far the book drifts;
 *  - it accrues **by the second**. The eight-hour window is the unit the
 *    rate is quoted in, not a block the engine batches into.
 *
 * It is carried as two cumulative indices, one per side, in 1e18 per unit of
 * notional. A position stores the index of its own side at open, and what it
 * owes at any later moment is `notional * (index now - index at open)`, which
 * is one subtraction rather than a loop over every second it was open.
 *
 * **The two sides move by the same magnitude.** Longs pay `m`, shorts receive
 * `m`, per unit of notional. When the book is lopsided the venue is carrying
 * the difference in exposure — it is the counterparty to the skew — and it
 * receives funding on exactly that difference, which falls out of settlement
 * without any transfer here. The alternative, scaling the thin side's credit
 * by the ratio of the two sides, lets a one-wei short earn an unbounded rate
 * and breaks the published cap on one side of the book.
 */
library Funding {
    /// @notice Fixed-point one.
    uint256 internal constant WAD = 1e18;
    /// @notice The cap, per unit of notional, over the quoted window: 0.75%.
    uint256 internal constant MAX_RATE = 0.0075e18;
    /// @notice The window the rate is quoted in.
    uint256 internal constant WINDOW = 8 hours;

    /**
     * @notice How far each side's index moves over `elapsed` seconds.
     * @param longOI     Long open interest, in notional.
     * @param shortOI    Short open interest, in notional.
     * @param skewScale  The imbalance at which the rate reaches its cap.
     * @param elapsed    Seconds since the last accrual.
     * @return deltaLong  Added to the long index. Positive means longs pay.
     * @return deltaShort Added to the short index.
     */
    function accrue(uint256 longOI, uint256 shortOI, uint256 skewScale, uint256 elapsed)
        internal
        pure
        returns (int256 deltaLong, int256 deltaShort)
    {
        // With one side empty there is nobody to pay and nobody to be paid.
        if (elapsed == 0 || skewScale == 0 || longOI == 0 || shortOI == 0) {
            return (0, 0);
        }

        bool longsPay = longOI > shortOI;
        uint256 gap = longsPay ? longOI - shortOI : shortOI - longOI;

        uint256 ratio = (gap * WAD) / skewScale;
        if (ratio > WAD) ratio = WAD;

        // Multiply before dividing: at the extremes this is ~1e18 * 7.5e15 *
        // elapsed, which is nowhere near the ceiling, and rounding down here
        // costs the payer nothing and the receiver nothing.
        uint256 magnitude = (ratio * MAX_RATE * elapsed) / (WAD * WINDOW);
        if (magnitude == 0) return (0, 0);

        return longsPay
            ? (int256(magnitude), -int256(magnitude))
            : (-int256(magnitude), int256(magnitude));
    }

    /**
     * @notice The rate a front end prints on the ticket, per 8h, signed.
     * @return A 1e18 share of notional. Positive means longs pay shorts.
     */
    function rate(uint256 longOI, uint256 shortOI, uint256 skewScale) internal pure returns (int256) {
        if (skewScale == 0 || longOI == 0 || shortOI == 0) return 0;

        bool longsPay = longOI > shortOI;
        uint256 gap = longsPay ? longOI - shortOI : shortOI - longOI;

        uint256 ratio = (gap * WAD) / skewScale;
        if (ratio > WAD) ratio = WAD;

        uint256 magnitude = (ratio * MAX_RATE) / WAD;
        return longsPay ? int256(magnitude) : -int256(magnitude);
    }
}
