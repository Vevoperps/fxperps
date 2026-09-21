// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {Funding} from "./libraries/Funding.sol";
import {PositionMath} from "./libraries/PositionMath.sol";

/**
 * @title PerpEngine
 * @notice Perpetual futures on the world's currencies, settled in one token.
 *
 * ## The shape of it
 *
 * The venue is the counterparty. There is no order book and nothing to slip
 * against: a trade fills at the oracle's mark, and the other side of it is a
 * pool of settlement tokens that liquidity providers own. That is what makes
 * a frontier pair tradeable at three in the morning, and it is also what the
 * payout cap is for — every open position has the most it can ever return
 * reserved out of the pool, so the number on the ticket is backed rather than
 * merely promised.
 *
 * ## What lives here
 *
 * One contract holds the settlement token and keeps four ledgers against it:
 *
 *  - `balanceOf`   — each trader's free balance, deposited and withdrawable;
 *  - `positions`   — one isolated position per trader per market;
 *  - `poolAssets`  — the liquidity backing every position, owned in shares;
 *  - `poolReserved`— the part of it already spoken for by open positions.
 *
 * Keeping them in one contract is deliberate. Margin, payouts, fees and
 * funding all move between the same four ledgers on the same token, and every
 * contract boundary in that path is a transfer that can half-succeed.
 *
 * ## Custody
 *
 * Nobody can move a trader's balance except that trader. There is no function
 * that lets the owner touch `balanceOf`, no pause that traps a withdrawal,
 * and `closePosition` is callable by its owner at any time on any market,
 * paused or not. The owner lists markets and sets their parameters; that is
 * the whole of what an admin key can do here.
 *
 * ## Maintenance is permissionless
 *
 * `poke` and `liquidate` are open to anyone. The keeper we run is a
 * convenience, not a dependency: if it stops, the arithmetic is still correct
 * the moment anybody touches the market, because funding is integrated from
 * the last timestamp rather than stepped forward by whoever calls.
 */
contract PerpEngine {
    using PositionMath for uint256;

    // ---------------------------------------------------------------- types

    struct Market {
        /// @dev The most leverage this pair will open at.
        uint32 maxLeverage;
        /// @dev The imbalance at which funding reaches its cap, in notional.
        uint128 skewScale;
        /// @dev The most notional this market will carry on either side.
        uint128 maxOpenInterest;
        /// @dev The smallest margin this market will open a position for.
        uint128 minMargin;
        uint128 longOpenInterest;
        uint128 shortOpenInterest;
        /// @dev Cumulative funding per unit of notional, 1e18, by side.
        int256 fundingLong;
        int256 fundingShort;
        uint64 lastAccrual;
        /**
         * @dev The mark one reference window ago, and when it was taken.
         *
         * The engine stores a price, not a history, so a "24h change" has to
         * come from somewhere. Rather than an indexer and a database, one
         * number per market is snapshotted once a window by whoever calls
         * `snapshot` — and `referenceAt` travels with it, so a front end can
         * tell a fresh reference from a stale one instead of printing a change
         * against a price from last week.
         */
        uint256 referencePrice;
        uint64 referenceAt;
        bool listed;
        /// @dev Paused markets refuse new positions. Closing always works.
        bool paused;
    }

    struct Position {
        uint128 margin;
        uint128 notional;
        /// @dev Fixed when the position opens, per the ticket.
        uint128 payoutCap;
        uint256 entryPrice;
        int256 entryFunding;
        uint64 openedAt;
        bool isLong;
        bool open;
    }

    /// @dev The working set of a close. Internal only; see `_price`.
    struct Close {
        uint256 marginOut;
        uint256 capOut;
        uint256 exitPrice;
        uint256 exitFee;
        int256 pnl;
        int256 funding;
        uint256 amount;
        bool whole;
    }

    /// @notice One market, priced, as a screen needs it.
    struct MarketView {
        bytes32 id;
        uint32 maxLeverage;
        uint128 longOpenInterest;
        uint128 shortOpenInterest;
        uint256 markPrice;
        /// @dev Per 8h, 1e18. Positive means longs pay.
        int256 fundingRate;
        bool listed;
        bool paused;
        /// @dev False when the oracle cannot price it right now.
        bool priced;
        /// @dev The mark one window ago, and when it was taken. Zero if never.
        uint256 referencePrice;
        uint64 referenceAt;
    }

    /// @notice Everything a front end needs for one open position, in one call.
    struct PositionView {
        Position position;
        uint256 markPrice;
        int256 pnl;
        int256 accruedFunding;
        int256 equity;
        uint256 maintenance;
        uint256 liquidationPrice;
        bool liquidatable;
    }

    // ------------------------------------------------------------ constants

    uint256 private constant BPS = 10_000;
    /// @notice The liquidator's cut of whatever equity is left, in bps.
    uint256 private constant LIQUIDATOR_SHARE_BPS = 5_000;
    /// @notice Shares minted for the first unit of liquidity, to price the pool.
    uint256 private constant INITIAL_SHARES = 1e18;
    /// @notice How often a market's reference mark may be refreshed.
    uint256 private constant REFERENCE_WINDOW = 24 hours;

    // -------------------------------------------------------------- storage

    IERC20 public immutable settlement;

    IOracle public oracle;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(bytes32 => Market) public markets;
    mapping(address => mapping(bytes32 => Position)) public positions;
    bytes32[] public marketIds;

    /// @notice Settlement tokens backing open positions.
    uint256 public poolAssets;
    /// @notice The part of `poolAssets` already promised to open positions.
    uint256 public poolReserved;
    uint256 public poolShares;
    mapping(address => uint256) public sharesOf;

    uint256 private locked = 1;

    // --------------------------------------------------------------- events

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 shares, uint256 amount);
    event MarketListed(bytes32 indexed market, uint32 maxLeverage, uint128 skewScale);
    event MarketConfigured(bytes32 indexed market, uint32 maxLeverage, uint128 skewScale, uint128 maxOpenInterest);
    event MarketPaused(bytes32 indexed market, bool paused);
    event FundingAccrued(bytes32 indexed market, int256 fundingLong, int256 fundingShort, uint64 at);
    event PositionOpened(
        address indexed account,
        bytes32 indexed market,
        bool isLong,
        uint256 margin,
        uint256 notional,
        uint256 entryPrice,
        uint256 fee
    );
    event MarginAdded(address indexed account, bytes32 indexed market, uint256 amount, uint256 margin);
    event PositionClosed(
        address indexed account,
        bytes32 indexed market,
        uint256 exitPrice,
        uint256 payout,
        int256 pnl,
        int256 funding,
        uint256 fee
    );
    /**
     * @dev A partial close. Deliberately a different event from `PositionClosed`:
     * anything watching the book — our own liquidator included — has to know
     * that the position is smaller, not gone.
     */
    event PositionReduced(
        address indexed account,
        bytes32 indexed market,
        uint256 exitPrice,
        uint256 closedNotional,
        uint256 payout,
        int256 pnl,
        int256 funding,
        uint256 fee
    );
    event PositionLiquidated(
        address indexed account, bytes32 indexed market, address indexed liquidator, uint256 exitPrice, uint256 reward
    );
    event ReferenceTaken(bytes32 indexed market, uint256 price, uint64 at);
    event OracleChanged(address oracle);
    event OwnershipTransferred(address indexed from, address indexed to);

    // --------------------------------------------------------------- errors

    error NotOwner();
    error Reentrant();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error UnknownMarket();
    error MarketIsPaused();
    error AlreadyListed();
    error PositionAlreadyOpen();
    error NoPosition();
    error LeverageTooHigh();
    error MarginTooSmall();
    error OpenInterestCap();
    error InsufficientLiquidity();
    error NotLiquidatable();
    error TransferFailed();

    // ------------------------------------------------------------ modifiers

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrant();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20 settlement_, IOracle oracle_, address owner_) {
        if (address(settlement_) == address(0) || address(oracle_) == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }

        settlement = settlement_;
        oracle = oracle_;
        owner = owner_;

        emit OwnershipTransferred(address(0), owner_);
    }

    // ------------------------------------------------------------- balances

    /// @notice Move settlement tokens in. Nothing trades until this happens.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        balanceOf[msg.sender] += amount;
        _pull(msg.sender, amount);

        emit Deposited(msg.sender, amount);
    }

    /// @notice Move free balance out. Margin behind an open position is not free.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();

        balanceOf[msg.sender] -= amount;
        _push(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    // ----------------------------------------------------------- liquidity

    /// @notice Back the venue's side of the book, in exchange for shares of it.
    function addLiquidity(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        shares = poolShares == 0 ? INITIAL_SHARES : (amount * poolShares) / poolAssets;
        if (shares == 0) revert ZeroAmount();

        poolShares += shares;
        poolAssets += amount;
        sharesOf[msg.sender] += shares;

        _pull(msg.sender, amount);

        emit LiquidityAdded(msg.sender, amount, shares);
    }

    /**
     * @notice Redeem shares for their part of the pool.
     *
     * Only the free part: liquidity already reserved against an open
     * position's payout cap cannot be withdrawn out from under it, which is
     * the whole reason the cap is worth anything.
     */
    function removeLiquidity(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        if (sharesOf[msg.sender] < shares) revert InsufficientBalance();

        amount = (shares * poolAssets) / poolShares;
        if (amount > poolFree()) revert InsufficientLiquidity();

        sharesOf[msg.sender] -= shares;
        poolShares -= shares;
        poolAssets -= amount;

        _push(msg.sender, amount);

        emit LiquidityRemoved(msg.sender, shares, amount);
    }

    /// @notice Pool liquidity not already promised to an open position.
    function poolFree() public view returns (uint256) {
        return poolAssets > poolReserved ? poolAssets - poolReserved : 0;
    }

    // -------------------------------------------------------------- trading

    /**
     * @notice Open an isolated position at the mark.
     * @param market   The market id, e.g. keccak256("USDJPY").
     * @param isLong   Which side.
     * @param margin   Settlement tokens to post, taken from the free balance.
     * @param leverage Whole multiple; notional is margin x leverage.
     */
    function openPosition(bytes32 market, bool isLong, uint256 margin, uint256 leverage) external nonReentrant {
        Market storage state = _market(market);
        if (state.paused) revert MarketIsPaused();
        if (leverage == 0 || leverage > state.maxLeverage) revert LeverageTooHigh();
        if (margin < state.minMargin) revert MarginTooSmall();

        Position storage position = positions[msg.sender][market];
        if (position.open) revert PositionAlreadyOpen();

        uint256 notional = margin * leverage;
        uint256 entryFee = PositionMath.fee(notional);

        if (balanceOf[msg.sender] < margin + entryFee) revert InsufficientBalance();

        _accrue(market, state);

        // The venue's exposure, not the trader's: the trader's own margin is
        // the first unit of the ten the ticket promises, so only the other
        // nine have to come out of the pool.
        uint256 reserve = margin * (PositionMath.PAYOUT_CAP - 1);
        if (reserve > poolFree()) revert InsufficientLiquidity();

        uint256 side = isLong ? state.longOpenInterest + notional : state.shortOpenInterest + notional;
        if (side > state.maxOpenInterest) revert OpenInterestCap();

        uint256 entryPrice = oracle.price(market);

        balanceOf[msg.sender] -= margin + entryFee;
        poolAssets += entryFee;
        poolReserved += reserve;

        if (isLong) {
            state.longOpenInterest = uint128(side);
        } else {
            state.shortOpenInterest = uint128(side);
        }

        positions[msg.sender][market] = Position({
            margin: uint128(margin),
            notional: uint128(notional),
            payoutCap: uint128(margin * PositionMath.PAYOUT_CAP),
            entryPrice: entryPrice,
            entryFunding: isLong ? state.fundingLong : state.fundingShort,
            openedAt: uint64(block.timestamp),
            isLong: isLong,
            open: true
        });

        emit PositionOpened(msg.sender, market, isLong, margin, notional, entryPrice, entryFee);
    }

    /**
     * @notice Post more margin behind an open position.
     *
     * The notional does not move, so this buys distance to the liquidation
     * price and nothing else. The payout cap was fixed when the position
     * opened and stays there.
     */
    function addMargin(bytes32 market, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage position = positions[msg.sender][market];
        if (!position.open) revert NoPosition();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();

        balanceOf[msg.sender] -= amount;
        position.margin += uint128(amount);

        emit MarginAdded(msg.sender, market, amount, position.margin);
    }

    /**
     * @notice Close at the mark and settle into the free balance.
     *
     * Callable on a paused market: pausing stops new risk, it does not trap
     * what is already open.
     */
    function closePosition(bytes32 market) external nonReentrant returns (uint256 amount) {
        Position storage position = positions[msg.sender][market];
        if (!position.open) revert NoPosition();

        return _reduce(msg.sender, market, position.notional);
    }

    /**
     * @notice Close part of a position at the mark.
     *
     * Everything scales with the notional being closed: its share of the
     * margin, its share of the payout cap, the funding accrued against it, and
     * the exit fee — so a half close pays half a fee, which is what the
     * handbook promises. What stays behind keeps its entry price and its entry
     * funding index, so the remainder is the same position it always was, only
     * smaller.
     *
     * Closing down to dust is refused rather than allowed: a position below the
     * market's minimum margin is one that cannot be liquidated economically.
     */
    function reducePosition(bytes32 market, uint256 notionalToClose)
        external
        nonReentrant
        returns (uint256 amount)
    {
        Position storage position = positions[msg.sender][market];
        if (!position.open) revert NoPosition();
        if (notionalToClose == 0 || notionalToClose > position.notional) revert ZeroAmount();

        return _reduce(msg.sender, market, notionalToClose);
    }

    /**
     * @notice Close a position whose equity has fallen to the maintenance margin.
     *
     * Anyone may call it, and whoever does takes half of whatever equity is
     * left as the fee for doing so. That is what the maintenance margin is
     * for: it is not a penalty, it is the budget for closing a position its
     * owner did not close.
     */
    function liquidate(address account, bytes32 market) external nonReentrant returns (uint256 reward) {
        Market storage state = _market(market);
        Position storage position = positions[account][market];
        if (!position.open) revert NoPosition();

        _accrue(market, state);

        uint256 exitPrice = oracle.price(market);
        int256 pnl = PositionMath.pnl(position.notional, position.entryPrice, exitPrice, position.isLong);
        int256 funding = _accruedFunding(state, position);
        int256 equity = PositionMath.equity(position.margin, pnl, funding);

        if (equity > int256(PositionMath.maintenance(position.notional))) revert NotLiquidatable();

        uint256 left = equity > 0 ? uint256(equity) : 0;
        reward = (left * LIQUIDATOR_SHARE_BPS) / BPS;

        // Everything not paid to the liquidator stays with the pool, which is
        // what carried the other side of the move.
        _settle(account, market, state, reward);
        balanceOf[msg.sender] += reward;

        emit PositionLiquidated(account, market, msg.sender, exitPrice, reward);
    }

    // ----------------------------------------------------------- maintenance

    /// @notice Bring a market's funding up to now. Permissionless, by design.
    function poke(bytes32 market) external {
        Market storage state = _market(market);
        _accrue(market, state);
    }

    /**
     * @notice Record the current mark as this market's reference price.
     *
     * This is what makes a 24h change possible without an indexer. Anyone may
     * call it and it does nothing until a window has passed, so a keeper can
     * run it on a loop and a stranger cannot move the reference around.
     *
     * It reverts if the oracle cannot price the market, because a reference
     * taken from a stale feed is worse than no reference at all.
     *
     * A market that has never been referenced is taken immediately. `0` is not
     * a timestamp, it is the absence of one, and reading it as a timestamp
     * would make the first reference wait a window from the epoch rather than
     * from the listing.
     *
     * @return taken True when a new reference was recorded.
     */
    function snapshot(bytes32 market) external returns (bool taken) {
        Market storage state = _market(market);
        if (state.referenceAt != 0 && block.timestamp < uint256(state.referenceAt) + REFERENCE_WINDOW) {
            return false;
        }

        state.referencePrice = oracle.price(market);
        state.referenceAt = uint64(block.timestamp);

        emit ReferenceTaken(market, state.referencePrice, state.referenceAt);
        return true;
    }

    // ----------------------------------------------------------------- views

    function marketCount() external view returns (uint256) {
        return marketIds.length;
    }

    /// @notice The oracle's mark for a market, 1e18.
    function markPrice(bytes32 market) external view returns (uint256) {
        return oracle.price(market);
    }

    /**
     * @notice Every market a screen asks for, priced, in one call.
     *
     * Sixty-four pairs times a mark, a rate and a row of open interest is
     * nearly two hundred calls per refresh if a front end asks for them one at
     * a time. This is the same information in one.
     *
     * A market whose oracle cannot price it right now comes back with
     * `priced: false` and a zero mark rather than reverting the whole batch.
     * One stale feed must not blank the table.
     */
    function marketsView(bytes32[] calldata ids) external view returns (MarketView[] memory out) {
        out = new MarketView[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            Market storage state = markets[ids[i]];

            out[i].id = ids[i];
            out[i].maxLeverage = state.maxLeverage;
            out[i].longOpenInterest = state.longOpenInterest;
            out[i].shortOpenInterest = state.shortOpenInterest;
            out[i].listed = state.listed;
            out[i].paused = state.paused;
            out[i].fundingRate = Funding.rate(state.longOpenInterest, state.shortOpenInterest, state.skewScale);
            out[i].referencePrice = state.referencePrice;
            out[i].referenceAt = state.referenceAt;

            if (!state.listed) continue;

            // The oracle reverts on an unwired or stale feed, which is correct
            // for a trade and wrong for a table.
            try this.markPrice(ids[i]) returns (uint256 mark) {
                out[i].markPrice = mark;
                out[i].priced = true;
            } catch {
                out[i].priced = false;
            }
        }
    }

    /// @notice Every position an account holds across the markets asked for.
    function positionsView(address account, bytes32[] calldata ids)
        external
        view
        returns (PositionView[] memory out)
    {
        out = new PositionView[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            try this.positionView(account, ids[i]) returns (PositionView memory one) {
                out[i] = one;
            } catch {
                // An unpriced market cannot report a pnl. The position itself
                // is still true, so it is returned without the live numbers.
                out[i].position = positions[account][ids[i]];
            }
        }
    }

    /// @notice Funding per 8h as the ticket prints it. Positive: longs pay.
    function fundingRate(bytes32 market) external view returns (int256) {
        Market storage state = markets[market];
        return Funding.rate(state.longOpenInterest, state.shortOpenInterest, state.skewScale);
    }

    /**
     * @notice Everything about one open position, priced now.
     *
     * The funding is projected to `block.timestamp` rather than read off the
     * last accrual, so the number here is the number a close would use even
     * if nobody has touched the market in a week.
     */
    function positionView(address account, bytes32 market) external view returns (PositionView memory view_) {
        Position memory position = positions[account][market];
        view_.position = position;
        if (!position.open) return view_;

        Market memory state = markets[market];
        (int256 deltaLong, int256 deltaShort) = Funding.accrue(
            state.longOpenInterest,
            state.shortOpenInterest,
            state.skewScale,
            block.timestamp - state.lastAccrual
        );

        int256 index = position.isLong ? state.fundingLong + deltaLong : state.fundingShort + deltaShort;

        view_.markPrice = oracle.price(market);
        view_.pnl = PositionMath.pnl(position.notional, position.entryPrice, view_.markPrice, position.isLong);
        view_.accruedFunding = (int256(uint256(position.notional)) * (index - position.entryFunding)) / int256(Funding.WAD);
        view_.equity = PositionMath.equity(position.margin, view_.pnl, view_.accruedFunding);
        view_.maintenance = PositionMath.maintenance(position.notional);
        view_.liquidationPrice = PositionMath.liquidationPrice(
            position.margin, position.notional, position.entryPrice, view_.accruedFunding, position.isLong
        );
        view_.liquidatable = view_.equity <= int256(view_.maintenance);
    }

    // ------------------------------------------------------------ governance

    function listMarket(
        bytes32 market,
        uint32 maxLeverage,
        uint128 skewScale,
        uint128 maxOpenInterest,
        uint128 minMargin
    ) external onlyOwner {
        if (markets[market].listed) revert AlreadyListed();
        if (maxLeverage == 0 || skewScale == 0) revert ZeroAmount();

        markets[market].listed = true;
        markets[market].maxLeverage = maxLeverage;
        markets[market].skewScale = skewScale;
        markets[market].maxOpenInterest = maxOpenInterest;
        markets[market].minMargin = minMargin;
        markets[market].lastAccrual = uint64(block.timestamp);
        marketIds.push(market);

        emit MarketListed(market, maxLeverage, skewScale);
    }

    function configureMarket(
        bytes32 market,
        uint32 maxLeverage,
        uint128 skewScale,
        uint128 maxOpenInterest,
        uint128 minMargin
    ) external onlyOwner {
        Market storage state = _market(market);
        if (maxLeverage == 0 || skewScale == 0) revert ZeroAmount();

        // Funding is a function of the scale, so it has to be brought up to
        // date on the old one before the new one takes effect.
        _accrue(market, state);

        state.maxLeverage = maxLeverage;
        state.skewScale = skewScale;
        state.maxOpenInterest = maxOpenInterest;
        state.minMargin = minMargin;

        emit MarketConfigured(market, maxLeverage, skewScale, maxOpenInterest);
    }

    function setPaused(bytes32 market, bool paused) external onlyOwner {
        Market storage state = _market(market);
        state.paused = paused;
        emit MarketPaused(market, paused);
    }

    function setOracle(IOracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleChanged(address(oracle_));
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    // -------------------------------------------------------------- internal

    function _market(bytes32 market) private view returns (Market storage state) {
        state = markets[market];
        if (!state.listed) revert UnknownMarket();
    }

    /// @dev Integrates funding from the last accrual to now.
    function _accrue(bytes32 market, Market storage state) private {
        uint256 elapsed = block.timestamp - state.lastAccrual;
        if (elapsed == 0) return;

        (int256 deltaLong, int256 deltaShort) =
            Funding.accrue(state.longOpenInterest, state.shortOpenInterest, state.skewScale, elapsed);

        state.lastAccrual = uint64(block.timestamp);
        if (deltaLong == 0 && deltaShort == 0) return;

        state.fundingLong += deltaLong;
        state.fundingShort += deltaShort;

        emit FundingAccrued(market, state.fundingLong, state.fundingShort, uint64(block.timestamp));
    }

    /// @dev What the position owes (positive) or is owed (negative), now.
    function _accruedFunding(Market storage state, Position storage position) private view returns (int256) {
        int256 index = position.isLong ? state.fundingLong : state.fundingShort;
        return (int256(uint256(position.notional)) * (index - position.entryFunding)) / int256(Funding.WAD);
    }

    /**
     * @dev Closes `closing` of a position's notional at the mark and pays out.
     *
     * Full and partial closes are the same operation — a full close is the one
     * where `closing` happens to be the whole notional — so there is only one
     * path through the arithmetic and only one place for it to be wrong.
     */
    function _reduce(address account, bytes32 market, uint256 closing) private returns (uint256) {
        Market storage state = _market(market);
        Position storage position = positions[account][market];

        _accrue(market, state);

        // One struct rather than a dozen locals: this path has to hold the
        // whole close in view at once, and a dozen locals is how it runs out
        // of stack.
        Close memory close = _price(market, state, position, closing);

        _release(state, position, closing, close.marginOut, close.capOut, close.amount);

        if (close.whole) {
            delete positions[account][market];
        } else {
            position.margin -= uint128(close.marginOut);
            position.notional -= uint128(closing);
            position.payoutCap -= uint128(close.capOut);
            // A stub too small to be worth liquidating is not a position, it
            // is a liability the pool would carry for free.
            if (position.margin < state.minMargin) revert MarginTooSmall();
        }

        balanceOf[account] += close.amount;

        if (close.whole) {
            emit PositionClosed(
                account, market, close.exitPrice, close.amount, close.pnl, close.funding, close.exitFee
            );
        } else {
            emit PositionReduced(
                account, market, close.exitPrice, closing, close.amount, close.pnl, close.funding, close.exitFee
            );
        }

        return close.amount;
    }

    /// @dev Every number a close produces, priced at the mark, before anything moves.
    function _price(bytes32 market, Market storage state, Position storage position, uint256 closing)
        private
        view
        returns (Close memory close)
    {
        uint256 notional = position.notional;
        close.whole = closing == notional;

        // Everything the position carries, in proportion to what is leaving.
        close.marginOut = close.whole ? position.margin : (uint256(position.margin) * closing) / notional;
        close.capOut = close.whole ? position.payoutCap : (uint256(position.payoutCap) * closing) / notional;

        close.exitPrice = oracle.price(market);
        close.exitFee = PositionMath.fee(closing);
        close.pnl = PositionMath.pnl(closing, position.entryPrice, close.exitPrice, position.isLong);

        int256 index = position.isLong ? state.fundingLong : state.fundingShort;
        close.funding = (int256(closing) * (index - position.entryFunding)) / int256(Funding.WAD);

        close.amount = PositionMath.payout(close.marginOut, close.pnl, close.funding, close.exitFee, close.capOut);
    }

    /**
     * @dev Retires a whole position and moves what it leaves behind into the pool.
     *
     * The margin was never in `poolAssets`, so the pool's result on the trade
     * is exactly `margin - paid`: it keeps what the position gave up and
     * funds what it won.
     */
    function _settle(address account, bytes32 market, Market storage state, uint256 paid) private {
        Position storage position = positions[account][market];

        _release(state, position, position.notional, position.margin, position.payoutCap, paid);

        delete positions[account][market];
    }

    /// @dev The book-keeping every close shares: open interest, reserve, pool.
    function _release(
        Market storage state,
        Position storage position,
        uint256 closing,
        uint256 marginOut,
        uint256 capOut,
        uint256 paid
    ) private {
        if (position.isLong) {
            state.longOpenInterest -= uint128(closing);
        } else {
            state.shortOpenInterest -= uint128(closing);
        }

        // What was reserved for this slice: nine tenths of its payout cap, the
        // cap being ten times the margin posted at open. The margin may have
        // grown since, and the reservation deliberately did not.
        uint256 reserve = (capOut / PositionMath.PAYOUT_CAP) * (PositionMath.PAYOUT_CAP - 1);
        poolReserved = poolReserved > reserve ? poolReserved - reserve : 0;

        if (paid > marginOut) {
            poolAssets -= paid - marginOut;
        } else {
            poolAssets += marginOut - paid;
        }
    }

    function _pull(address from, uint256 amount) private {
        if (!settlement.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _push(address to, uint256 amount) private {
        if (!settlement.transfer(to, amount)) revert TransferFailed();
    }
}
