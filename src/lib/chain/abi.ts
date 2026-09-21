/**
 * The venue's ABIs, in ethers' human-readable form.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with `node tools/gen-abi.mjs` from `backend/`, after
 * `forge build`. The contracts are the source; this is a copy that ships.
 */

export const PERP_ENGINE_ABI = [
  "constructor(address settlement_, address oracle_, address owner_)",
  "error AlreadyListed()",
  "error InsufficientBalance()",
  "error InsufficientLiquidity()",
  "error LeverageTooHigh()",
  "error MarginTooSmall()",
  "error MarketIsPaused()",
  "error NoPosition()",
  "error NotLiquidatable()",
  "error NotOwner()",
  "error OpenInterestCap()",
  "error PositionAlreadyOpen()",
  "error Reentrant()",
  "error TransferFailed()",
  "error UnknownMarket()",
  "error ZeroAddress()",
  "error ZeroAmount()",
  "event Deposited(address indexed account, uint256 amount)",
  "event FundingAccrued(bytes32 indexed market, int256 fundingLong, int256 fundingShort, uint64 at)",
  "event LiquidityAdded(address indexed provider, uint256 amount, uint256 shares)",
  "event LiquidityRemoved(address indexed provider, uint256 shares, uint256 amount)",
  "event MarginAdded(address indexed account, bytes32 indexed market, uint256 amount, uint256 margin)",
  "event MarketConfigured(bytes32 indexed market, uint32 maxLeverage, uint128 skewScale, uint128 maxOpenInterest)",
  "event MarketListed(bytes32 indexed market, uint32 maxLeverage, uint128 skewScale)",
  "event MarketPaused(bytes32 indexed market, bool paused)",
  "event OracleChanged(address oracle)",
  "event OwnershipTransferred(address indexed from, address indexed to)",
  "event PositionClosed(address indexed account, bytes32 indexed market, uint256 exitPrice, uint256 payout, int256 pnl, int256 funding, uint256 fee)",
  "event PositionLiquidated(address indexed account, bytes32 indexed market, address indexed liquidator, uint256 exitPrice, uint256 reward)",
  "event PositionOpened(address indexed account, bytes32 indexed market, bool isLong, uint256 margin, uint256 notional, uint256 entryPrice, uint256 fee)",
  "event PositionReduced(address indexed account, bytes32 indexed market, uint256 exitPrice, uint256 closedNotional, uint256 payout, int256 pnl, int256 funding, uint256 fee)",
  "event ReferenceTaken(bytes32 indexed market, uint256 price, uint64 at)",
  "event Withdrawn(address indexed account, uint256 amount)",
  "function addLiquidity(uint256 amount) returns (uint256 shares)",
  "function addMargin(bytes32 market, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function closePosition(bytes32 market) returns (uint256 amount)",
  "function configureMarket(bytes32 market, uint32 maxLeverage, uint128 skewScale, uint128 maxOpenInterest, uint128 minMargin)",
  "function deposit(uint256 amount)",
  "function fundingRate(bytes32 market) view returns (int256)",
  "function liquidate(address account, bytes32 market) returns (uint256 reward)",
  "function listMarket(bytes32 market, uint32 maxLeverage, uint128 skewScale, uint128 maxOpenInterest, uint128 minMargin)",
  "function markPrice(bytes32 market) view returns (uint256)",
  "function marketCount() view returns (uint256)",
  "function marketIds(uint256) view returns (bytes32)",
  "function markets(bytes32) view returns (uint32 maxLeverage, uint128 skewScale, uint128 maxOpenInterest, uint128 minMargin, uint128 longOpenInterest, uint128 shortOpenInterest, int256 fundingLong, int256 fundingShort, uint64 lastAccrual, uint256 referencePrice, uint64 referenceAt, bool listed, bool paused)",
  "function marketsView(bytes32[] ids) view returns ((bytes32 id, uint32 maxLeverage, uint128 longOpenInterest, uint128 shortOpenInterest, uint256 markPrice, int256 fundingRate, bool listed, bool paused, bool priced, uint256 referencePrice, uint64 referenceAt)[] out)",
  "function openPosition(bytes32 market, bool isLong, uint256 margin, uint256 leverage)",
  "function oracle() view returns (address)",
  "function owner() view returns (address)",
  "function poke(bytes32 market)",
  "function poolAssets() view returns (uint256)",
  "function poolFree() view returns (uint256)",
  "function poolReserved() view returns (uint256)",
  "function poolShares() view returns (uint256)",
  "function positionView(address account, bytes32 market) view returns (((uint128 margin, uint128 notional, uint128 payoutCap, uint256 entryPrice, int256 entryFunding, uint64 openedAt, bool isLong, bool open) position, uint256 markPrice, int256 pnl, int256 accruedFunding, int256 equity, uint256 maintenance, uint256 liquidationPrice, bool liquidatable) view_)",
  "function positions(address, bytes32) view returns (uint128 margin, uint128 notional, uint128 payoutCap, uint256 entryPrice, int256 entryFunding, uint64 openedAt, bool isLong, bool open)",
  "function positionsView(address account, bytes32[] ids) view returns (((uint128 margin, uint128 notional, uint128 payoutCap, uint256 entryPrice, int256 entryFunding, uint64 openedAt, bool isLong, bool open) position, uint256 markPrice, int256 pnl, int256 accruedFunding, int256 equity, uint256 maintenance, uint256 liquidationPrice, bool liquidatable)[] out)",
  "function reducePosition(bytes32 market, uint256 notionalToClose) returns (uint256 amount)",
  "function removeLiquidity(uint256 shares) returns (uint256 amount)",
  "function setOracle(address oracle_)",
  "function setPaused(bytes32 market, bool paused)",
  "function settlement() view returns (address)",
  "function sharesOf(address) view returns (uint256)",
  "function snapshot(bytes32 market) returns (bool taken)",
  "function transferOwnership(address to)",
  "function withdraw(uint256 amount)",
] as const;

/** Only the parts of the settlement token the app touches. */
export const SETTLEMENT_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

/** The testnet faucet. Present on MockUSDG only; absent on a real token. */
export const FAUCET_ABI = ["function mint(address to, uint256 amount)"] as const;
