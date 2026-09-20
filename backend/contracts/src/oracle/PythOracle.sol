// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracle} from "../interfaces/IOracle.sol";
import {IPyth} from "../interfaces/IPyth.sol";

/**
 * @title PythOracle
 * @notice Turns a Pyth feed into the one number the engine asks for.
 *
 * Three things happen here and nothing else:
 *
 *  1. the market id is mapped to the feed id Pyth knows it by;
 *  2. the price is read with a **staleness bound**, so a feed nobody has
 *     pushed in a while reverts rather than quoting yesterday;
 *  3. Pyth's own exponent is normalised to 1e18, because every other part of
 *     the system is in 1e18 and a feed that quietly changes exponent should
 *     not be able to move a mark by eight orders of magnitude.
 *
 * There is also a **confidence bound**. Pyth publishes an interval alongside
 * every price, and it widens exactly when a market is disorderly. Quoting a
 * mark whose own publisher is unsure of it to within a percent is how a venue
 * liquidates people on noise, so past `maxConfidenceBps` this reverts too.
 *
 * Pyth is pull-based: this contract only reads. Posting updates on chain is
 * `IPyth.updatePriceFeeds`, which is the keeper's job and is paid for in the
 * chain's own gas token.
 */
contract PythOracle is IOracle {
    struct Feed {
        bytes32 id;
        /// @dev Seconds a price may be old before this market stops trading.
        uint32 maxAge;
        /// @dev Widest publisher interval tolerated, in bps of the price.
        uint32 maxConfidenceBps;
        /**
         * @dev Quote the reciprocal of what the feed publishes.
         *
         * Every market on this venue is "local currency per one dollar", which
         * is the convention the site is built on and the one a trader reading
         * a frontier pair actually wants. The market quotes half of them the
         * other way up — Pyth publishes EUR/USD, not USD/EUR — so those feeds
         * carry this flag and are inverted here rather than in four different
         * places downstream.
         */
        bool invert;
        bool set;
    }

    uint256 private constant WAD = 1e18;

    IPyth public immutable pyth;
    address public owner;

    mapping(bytes32 => Feed) public feeds;

    event FeedSet(bytes32 indexed market, bytes32 indexed feed, uint32 maxAge, uint32 maxConfidenceBps, bool invert);
    event FeedCleared(bytes32 indexed market);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error UnknownFeed();
    error BadPrice();
    error TooUncertain();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPyth pyth_, address owner_) {
        if (address(pyth_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        pyth = pyth_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @inheritdoc IOracle
    function price(bytes32 market) external view returns (uint256) {
        Feed memory feed = feeds[market];
        if (!feed.set) revert UnknownFeed();

        IPyth.Price memory quote = pyth.getPriceNoOlderThan(feed.id, feed.maxAge);
        if (quote.price <= 0) revert BadPrice();

        uint256 raw = uint256(uint64(quote.price));

        if (feed.maxConfidenceBps != 0) {
            // conf and price share an exponent, so the ratio is exponent-free.
            if (uint256(quote.conf) * 10_000 > raw * feed.maxConfidenceBps) revert TooUncertain();
        }

        uint256 wad = _toWad(raw, quote.expo);
        if (wad == 0) revert BadPrice();

        return feed.invert ? (WAD * WAD) / wad : wad;
    }

    /// @inheritdoc IOracle
    function hasFeed(bytes32 market) external view returns (bool) {
        return feeds[market].set;
    }

    function setFeed(bytes32 market, bytes32 feed, uint32 maxAge, uint32 maxConfidenceBps, bool invert)
        external
        onlyOwner
    {
        if (feed == bytes32(0) || maxAge == 0) revert UnknownFeed();
        feeds[market] =
            Feed({id: feed, maxAge: maxAge, maxConfidenceBps: maxConfidenceBps, invert: invert, set: true});
        emit FeedSet(market, feed, maxAge, maxConfidenceBps, invert);
    }

    function clearFeed(bytes32 market) external onlyOwner {
        delete feeds[market];
        emit FeedCleared(market);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    /// @dev `raw * 10^expo`, expressed in 1e18.
    function _toWad(uint256 raw, int32 expo) private pure returns (uint256) {
        int256 shift = int256(18) + int256(expo);

        if (shift >= 0) {
            if (shift > 60) revert BadPrice();
            return raw * (10 ** uint256(shift));
        }

        if (-shift > 60) revert BadPrice();
        return raw / (10 ** uint256(-shift));
    }
}
