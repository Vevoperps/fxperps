// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracle} from "../interfaces/IOracle.sol";

/**
 * @title PushOracle
 * @notice Marks posted by named publishers, behind the same `IOracle` the
 *         engine already reads.
 *
 * ## Why this exists
 *
 * Pyth signs its prices and verifies them on chain, which is the arrangement
 * this venue was designed around and the one it should end on. But Pyth's FX
 * feeds are licensed data: an API key does not entitle an account to them, and
 * the thirty-five frontier currencies this venue lists are not published at
 * all. So the choice is between a venue that prices twenty-nine pairs and one
 * that prices sixty-four, and this contract is the second answer.
 *
 * ## What it costs, stated plainly
 *
 * **A publisher sets the mark.** Not a market, not a signature anybody can
 * check — an address this contract trusts. That address can post a wrong
 * price, and a wrong price liquidates positions. Nothing here pretends
 * otherwise, and anything built on it should say so where its users read it.
 *
 * Three things narrow the damage, and none of them removes it:
 *
 *  - **Marks go stale.** A price older than `maxAge` reverts rather than
 *    trades. A publisher that stops posting stops the venue; it does not
 *    freeze the book at a convenient number.
 *  - **A publisher cannot move a mark arbitrarily far in one step.**
 *    `maxDeviationBps` bounds each post against the previous one, so taking a
 *    publisher key buys a slow walk rather than an instant print at zero.
 *  - **Publishers are named and revocable**, and adding one is an owner action
 *    that emits an event.
 *
 * ## Quoting convention
 *
 * Every mark is local currency per one dollar, scaled to 1e18 — the same
 * convention the rest of the venue uses, so nothing here inverts anything.
 */
contract PushOracle is IOracle {
    struct Mark {
        uint192 price;
        uint64 updatedAt;
    }

    /// @notice One dollar, in the fixed point everything here speaks.
    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 10_000;

    address public owner;

    /// @notice Seconds a mark may be old before this oracle refuses to price it.
    uint32 public maxAge;

    /**
     * @notice The furthest one post may move a mark, in bps of the last one.
     *
     * Zero disables the check, which is the right setting for the first post
     * of a market and the wrong one for every post after it.
     */
    uint32 public maxDeviationBps;

    mapping(bytes32 => Mark) public marks;
    mapping(address => bool) public publishers;

    event MarkPosted(bytes32 indexed market, uint256 price, uint64 at, address indexed publisher);
    event PublisherSet(address indexed publisher, bool allowed);
    event MaxAgeSet(uint32 seconds_);
    event MaxDeviationSet(uint32 bps);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPublisher();
    error ZeroAddress();
    error ZeroPrice();
    error LengthMismatch();
    error NoFeed();
    error StalePrice();
    error DeviationTooLarge();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, uint32 maxAge_, uint32 maxDeviationBps_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        maxAge = maxAge_;
        maxDeviationBps = maxDeviationBps_;
        emit OwnershipTransferred(address(0), owner_);
    }

    // ------------------------------------------------------------- reading

    /// @inheritdoc IOracle
    function price(bytes32 market) external view returns (uint256) {
        Mark memory mark = marks[market];
        if (mark.updatedAt == 0) revert NoFeed();
        if (block.timestamp > uint256(mark.updatedAt) + maxAge) revert StalePrice();
        return mark.price;
    }

    /**
     * @inheritdoc IOracle
     * @dev False for a mark that has gone stale, because a front end asking
     * "can this be traded right now" wants the same answer `price` would give.
     */
    function hasFeed(bytes32 market) external view returns (bool) {
        Mark memory mark = marks[market];
        return mark.updatedAt != 0 && block.timestamp <= uint256(mark.updatedAt) + maxAge;
    }

    /// @notice The mark and its age, for a keeper deciding what to refresh.
    function markAt(bytes32 market) external view returns (uint256 value, uint64 at) {
        Mark memory mark = marks[market];
        return (mark.price, mark.updatedAt);
    }

    // ------------------------------------------------------------- writing

    /**
     * @notice Post marks for one or more markets.
     *
     * Batched because a venue with sixty-four markets refreshed one
     * transaction at a time is a venue whose prices disagree with each other
     * by a minute.
     */
    function postMarks(bytes32[] calldata markets, uint256[] calldata values) external {
        if (!publishers[msg.sender]) revert NotPublisher();
        if (markets.length != values.length) revert LengthMismatch();

        for (uint256 i = 0; i < markets.length; i++) {
            _post(markets[i], values[i]);
        }
    }

    function _post(bytes32 market, uint256 value) private {
        if (value == 0) revert ZeroPrice();

        Mark storage mark = marks[market];

        // The first post of a market has nothing to deviate from, and a mark
        // that has already gone stale is not a reference either — the world
        // moved while nobody was posting, and holding the new price to the old
        // one would lock the market out for as long as it took to notice.
        bool comparable = mark.updatedAt != 0 && maxDeviationBps != 0
            && block.timestamp <= uint256(mark.updatedAt) + maxAge;

        if (comparable) {
            uint256 previous = mark.price;
            uint256 gap = value > previous ? value - previous : previous - value;
            if ((gap * BPS) / previous > maxDeviationBps) revert DeviationTooLarge();
        }

        mark.price = uint192(value);
        mark.updatedAt = uint64(block.timestamp);

        emit MarkPosted(market, value, uint64(block.timestamp), msg.sender);
    }

    // --------------------------------------------------------------- admin

    function setPublisher(address publisher, bool allowed) external onlyOwner {
        if (publisher == address(0)) revert ZeroAddress();
        publishers[publisher] = allowed;
        emit PublisherSet(publisher, allowed);
    }

    function setMaxAge(uint32 seconds_) external onlyOwner {
        maxAge = seconds_;
        emit MaxAgeSet(seconds_);
    }

    function setMaxDeviation(uint32 bps) external onlyOwner {
        maxDeviationBps = bps;
        emit MaxDeviationSet(bps);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }
}
