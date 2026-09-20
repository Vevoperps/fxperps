// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IPyth
 * @notice The part of Pyth's on-chain contract we touch.
 *
 * Pyth is pull-based: prices live off chain until somebody pays to post them.
 * `updatePriceFeeds` is that push and is what the keeper calls; everything
 * else here only reads what the last push left behind.
 */
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    /// @notice Reverts if the newest price for `id` is older than `age` seconds.
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);

    /// @notice The wei that must accompany `updatePriceFeeds` for this payload.
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);

    /// @notice Posts signed price updates on chain. Payable; the keeper's job.
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
