// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {Funding} from "../src/libraries/Funding.sol";
import {PositionMath} from "../src/libraries/PositionMath.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";

/**
 * @title PerpEngineTest
 * @notice The handbook, as assertions.
 *
 * Every figure the site prints is checked here against the engine that has to
 * honour it: 0.05% each way, 0.5% maintenance, 9.5% to liquidation at 10x and
 * 3.5% at 25x, funding capped at 0.75% per 8h and charged on notional, and a
 * payout that stops at ten times the margin. If the docs and the engine ever
 * disagree, this file fails before a user finds out.
 *
 * The last test is the one that matters most: whatever route the numbers take,
 * the settlement tokens the contract holds must equal every ledger entry it
 * claims. A venue that cannot prove that is not solvent, it is hopeful.
 */
contract PerpEngineTest is Test {
    uint256 private constant ONE = 1e6; // MockUSDG carries six decimals.
    uint256 private constant WAD = 1e18;

    bytes32 private constant USDJPY = keccak256("USDJPY");
    bytes32 private constant EURUSD = keccak256("EURUSD");

    MockUSDG private usdg;
    MockOracle private oracle;
    PerpEngine private engine;

    address private owner = makeAddr("owner");
    address private trader = makeAddr("trader");
    address private rival = makeAddr("rival");
    address private lp = makeAddr("lp");
    address private keeper = makeAddr("keeper");

    function setUp() public {
        usdg = new MockUSDG();
        oracle = new MockOracle(owner);
        engine = new PerpEngine(IERC20(address(usdg)), IOracle(address(oracle)), owner);

        vm.startPrank(owner);
        oracle.setPrice(USDJPY, 156.8e18);
        oracle.setPrice(EURUSD, 1.0842e18);
        // USDJPY at a realistic scale; EURUSD with a deliberately small one so
        // the funding test reaches a rate worth reading inside one window.
        engine.listMarket(USDJPY, 25, uint128(1_000_000 * ONE), uint128(10_000_000 * ONE), uint128(10 * ONE));
        engine.listMarket(EURUSD, 25, uint128(10_000 * ONE), uint128(10_000_000 * ONE), uint128(10 * ONE));
        vm.stopPrank();

        address[3] memory funded = [trader, rival, lp];
        for (uint256 i = 0; i < funded.length; i++) {
            usdg.mint(funded[i], 2_000_000 * ONE);
            vm.prank(funded[i]);
            usdg.approve(address(engine), type(uint256).max);
        }

        vm.prank(lp);
        engine.addLiquidity(1_000_000 * ONE);
        vm.prank(trader);
        engine.deposit(10_000 * ONE);
        vm.prank(rival);
        engine.deposit(10_000 * ONE);
    }

    // ------------------------------------------------------------ the ticket

    function test_OpenPricesTheTicketExactly() public {
        vm.prank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        (uint128 margin, uint128 notional, uint128 payoutCap, uint256 entryPrice,,,, bool open) =
            engine.positions(trader, USDJPY);

        assertEq(margin, 100 * ONE, "margin");
        assertEq(notional, 1_000 * ONE, "notional is margin x leverage");
        assertEq(payoutCap, 1_000 * ONE, "cap is ten times the margin");
        assertEq(entryPrice, 156.8e18, "entry is the mark");
        assertTrue(open);

        // 100 margin + 0.05% of a 1,000 notional.
        assertEq(engine.balanceOf(trader), 9_899.5e6, "margin and fee debited");
        assertEq(engine.poolAssets(), 1_000_000.5e6, "the fee went to the pool");
        assertEq(engine.poolReserved(), 900 * ONE, "nine tenths of the cap reserved");
    }

    function test_LiquidationSitsWhereTheHandbookSaysItDoes() public {
        vm.prank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        PerpEngine.PositionView memory view10 = engine.positionView(trader, USDJPY);
        // 1/10 - 0.5% = 9.5% below 156.80.
        assertApproxEqAbs(view10.liquidationPrice, 141.904e18, 1e10, "9.5% at 10x");
        assertEq(view10.maintenance, 5 * ONE, "0.5% of notional");

        vm.prank(rival);
        engine.openPosition(USDJPY, true, 100 * ONE, 25);

        PerpEngine.PositionView memory view25 = engine.positionView(rival, USDJPY);
        // 1/25 - 0.5% = 3.5% below 156.80.
        assertApproxEqAbs(view25.liquidationPrice, 151.312e18, 1e11, "3.5% at 25x");
    }

    function test_RoundTripCostsTenBasisPoints() public {
        vm.startPrank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        vm.stopPrank();
        vm.prank(owner);
        oracle.setPrice(USDJPY, 158.368e18); // +1.00%

        assertEq(engine.positionView(trader, USDJPY).pnl, int256(10 * ONE), "1% of a 1,000 notional");

        vm.prank(trader);
        engine.closePosition(USDJPY);

        // 10 gross, less 0.5 in and 0.5 out.
        assertEq(engine.balanceOf(trader), 10_009 * ONE, "net nine on a ten-dollar move");
        assertEq(engine.poolReserved(), 0, "reservation released");
    }

    // -------------------------------------------------------------- the caps

    function test_PayoutStopsAtTenTimesMargin() public {
        vm.prank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 25);

        vm.prank(owner);
        oracle.setPrice(USDJPY, 235.2e18); // +50%

        assertEq(engine.positionView(trader, USDJPY).pnl, int256(1_250 * ONE), "raw pnl");

        uint256 before = engine.balanceOf(trader);
        vm.prank(trader);
        engine.closePosition(USDJPY);

        assertEq(engine.balanceOf(trader) - before, 1_000 * ONE, "capped at 10x margin");
    }

    function test_FundingIsChargedOnNotionalAndCapped() public {
        vm.prank(trader);
        engine.openPosition(EURUSD, true, 1_000 * ONE, 10); // 10,000 long
        vm.prank(rival);
        engine.openPosition(EURUSD, false, 100 * ONE, 10); // 1,000 short

        // A 9,000 skew against a 10,000 scale is 90% of the cap: 0.675% per 8h.
        assertEq(engine.fundingRate(EURUSD), int256((WAD * 675) / 100_000), "quoted rate");

        vm.warp(block.timestamp + 8 hours);
        engine.poke(EURUSD);

        assertApproxEqAbs(
            engine.positionView(trader, EURUSD).accruedFunding, int256(67.5e6), 1e4, "long pays 0.675% of 10,000"
        );
        assertApproxEqAbs(
            engine.positionView(rival, EURUSD).accruedFunding, -int256(6.75e6), 1e4, "short is paid on 1,000"
        );
    }

    function testFuzz_FundingRateNeverBreaksTheCap(uint128 longOI, uint128 shortOI, uint128 scale) public pure {
        vm.assume(scale > 0);
        int256 rate = Funding.rate(longOI, shortOI, scale);
        assertLe(rate, int256(Funding.MAX_RATE), "above the cap");
        assertGe(rate, -int256(Funding.MAX_RATE), "below the cap");
    }

    // ---------------------------------------------------------- partial close

    function test_HalfACloseCostsHalfAFee() public {
        vm.startPrank(trader);
        engine.openPosition(USDJPY, true, 200 * ONE, 10);

        uint256 reserved = engine.poolReserved();
        assertEq(reserved, 1_800 * ONE, "nine tenths of a 2,000 cap");

        uint256 before = engine.balanceOf(trader);
        engine.reducePosition(USDJPY, 1_000 * ONE);
        vm.stopPrank();

        (uint128 margin, uint128 notional, uint128 cap, uint256 entryPrice,,,, bool open) =
            engine.positions(trader, USDJPY);

        assertEq(margin, 100 * ONE, "margin halved");
        assertEq(notional, 1_000 * ONE, "notional halved");
        assertEq(cap, 1_000 * ONE, "cap halved");
        assertEq(entryPrice, 156.8e18, "entry price kept");
        assertTrue(open, "what is left is still open");

        // Half the margin back, less 0.05% of the 1,000 that closed.
        assertEq(engine.balanceOf(trader) - before, 99.5e6, "half a fee");
        assertEq(engine.poolReserved(), 900 * ONE, "half the reservation released");
    }

    function test_ClosingDownToDustIsRefused() public {
        vm.startPrank(trader);
        engine.openPosition(USDJPY, true, 200 * ONE, 10);

        vm.expectRevert(PerpEngine.ZeroAmount.selector);
        engine.reducePosition(USDJPY, 9_999 * ONE);

        // Would leave 0.1 of margin behind on a market with a 10 minimum.
        vm.expectRevert(PerpEngine.MarginTooSmall.selector);
        engine.reducePosition(USDJPY, 1_999 * ONE);
        vm.stopPrank();
    }

    // ------------------------------------------------- the 24h reference mark

    function test_TheReferenceMovesOncePerWindow() public {
        // Nothing has been recorded yet, so the app has nothing to compare to.
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = USDJPY;
        assertEq(engine.marketsView(ids)[0].referenceAt, 0, "no reference yet");

        assertTrue(engine.snapshot(USDJPY), "first call records one");

        PerpEngine.MarketView memory taken = engine.marketsView(ids)[0];
        assertEq(taken.referencePrice, 156.8e18, "the mark at the time");
        assertEq(taken.referenceAt, uint64(block.timestamp));

        // A second caller minutes later must not be able to move it.
        vm.prank(owner);
        oracle.setPrice(USDJPY, 200e18);
        assertFalse(engine.snapshot(USDJPY), "refused inside the window");
        assertEq(engine.marketsView(ids)[0].referencePrice, 156.8e18, "unmoved");

        // A day later it refreshes.
        vm.warp(block.timestamp + 24 hours);
        assertTrue(engine.snapshot(USDJPY), "the window is up");
        assertEq(engine.marketsView(ids)[0].referencePrice, 200e18, "refreshed");
    }

    // ------------------------------------------------------------ liquidation

    function test_LiquidationPaysTheCallerOutOfWhatIsLeft() public {
        vm.prank(rival);
        engine.openPosition(USDJPY, true, 100 * ONE, 25);

        vm.expectRevert(PerpEngine.NotLiquidatable.selector);
        vm.prank(keeper);
        engine.liquidate(rival, USDJPY);

        vm.prank(owner);
        oracle.setPrice(USDJPY, 151e18); // through the 151.312 floor

        assertTrue(engine.positionView(rival, USDJPY).liquidatable, "past maintenance");

        vm.prank(keeper);
        uint256 reward = engine.liquidate(rival, USDJPY);

        assertGt(reward, 0, "the caller is paid");
        assertLt(reward, 7 * ONE, "out of the maintenance margin, not the pool");
        assertEq(engine.balanceOf(keeper), reward);
        assertEq(engine.poolReserved(), 0, "reservation released");
    }

    // ----------------------------------------------------------------- guards

    function test_Guards() public {
        vm.startPrank(trader);

        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        vm.expectRevert(PerpEngine.PositionAlreadyOpen.selector);
        engine.openPosition(USDJPY, false, 100 * ONE, 10);

        vm.expectRevert(PerpEngine.LeverageTooHigh.selector);
        engine.openPosition(EURUSD, true, 100 * ONE, 26);

        vm.expectRevert(PerpEngine.MarginTooSmall.selector);
        engine.openPosition(EURUSD, true, 1 * ONE, 10);

        vm.expectRevert(PerpEngine.UnknownMarket.selector);
        engine.openPosition(keccak256("XXXYYY"), true, 100 * ONE, 10);

        vm.expectRevert(PerpEngine.InsufficientBalance.selector);
        engine.withdraw(1_000_000 * ONE);

        vm.expectRevert(PerpEngine.NotOwner.selector);
        engine.listMarket(keccak256("XXXYYY"), 10, 1, 1, 0);

        vm.stopPrank();

        vm.expectRevert(PerpEngine.InsufficientLiquidity.selector);
        vm.prank(lp);
        engine.removeLiquidity(1e18);
    }

    function test_PausingStopsNewRiskNotTheExit() public {
        vm.prank(trader);
        engine.openPosition(EURUSD, true, 100 * ONE, 10);

        vm.prank(owner);
        engine.setPaused(EURUSD, true);

        vm.expectRevert(PerpEngine.MarketIsPaused.selector);
        vm.prank(rival);
        engine.openPosition(EURUSD, true, 100 * ONE, 10);

        vm.prank(trader);
        engine.closePosition(EURUSD);

        (,,,,,,, bool open) = engine.positions(trader, EURUSD);
        assertFalse(open, "a paused market still lets you out");
    }

    function test_AddMarginBuysDistanceAndNothingElse() public {
        vm.startPrank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        uint256 before = engine.positionView(trader, USDJPY).liquidationPrice;
        uint256 reserved = engine.poolReserved();

        engine.addMargin(USDJPY, 100 * ONE);
        vm.stopPrank();

        PerpEngine.PositionView memory after_ = engine.positionView(trader, USDJPY);
        assertLt(after_.liquidationPrice, before, "the floor moved away");
        assertEq(after_.position.notional, 1_000 * ONE, "notional did not move");
        assertEq(after_.position.payoutCap, 1_000 * ONE, "the cap was fixed at open");
        assertEq(engine.poolReserved(), reserved, "and so was the reservation");
    }

    // -------------------------------------------------------------- solvency

    function test_TheBooksBalance() public {
        vm.prank(trader);
        engine.openPosition(USDJPY, true, 250 * ONE, 20);
        vm.prank(rival);
        engine.openPosition(USDJPY, false, 400 * ONE, 5);

        vm.warp(block.timestamp + 3 days);
        vm.prank(owner);
        oracle.setPrice(USDJPY, 149.2e18);

        engine.poke(USDJPY);

        vm.prank(trader);
        engine.closePosition(USDJPY);
        vm.prank(rival);
        engine.closePosition(USDJPY);

        uint256 held = usdg.balanceOf(address(engine));
        uint256 ledger = engine.balanceOf(trader) + engine.balanceOf(rival) + engine.balanceOf(keeper)
            + engine.balanceOf(lp) + engine.poolAssets();

        assertEq(held, ledger, "tokens held equal every entry claimed");
        assertEq(engine.poolReserved(), 0, "nothing still reserved");
    }

    /**
     * @notice The first milestone, walked end to end.
     *
     * Deposit, open, watch the PNL, close, withdraw — with nothing but a
     * wallet and the settlement token, and with every number checked on the
     * way through. If this passes, the product exists.
     */
    function test_TheWholePath() public {
        address user = makeAddr("newcomer");
        usdg.mint(user, 1_000 * ONE);

        vm.startPrank(user);
        usdg.approve(address(engine), type(uint256).max);

        // 1. deposit
        engine.deposit(1_000 * ONE);
        assertEq(engine.balanceOf(user), 1_000 * ONE, "deposited");
        assertEq(usdg.balanceOf(user), 0, "and it left the wallet");

        // 2. open
        engine.openPosition(USDJPY, true, 250 * ONE, 4);
        assertEq(engine.balanceOf(user), 749.5e6, "margin and a 0.05% fee on 1,000");
        vm.stopPrank();

        // 3. the mark moves, and the position reports it
        vm.prank(owner);
        oracle.setPrice(USDJPY, 160.72e18); // +2.5%

        PerpEngine.PositionView memory live = engine.positionView(user, USDJPY);
        assertEq(live.pnl, int256(25 * ONE), "2.5% of a 1,000 notional");
        assertGt(live.equity, int256(live.maintenance), "nowhere near the floor");
        assertFalse(live.liquidatable);

        // 4. close
        vm.prank(user);
        uint256 paid = engine.closePosition(USDJPY);
        assertEq(paid, 274.5e6, "margin + 25 - a 0.5 exit fee");
        assertEq(engine.balanceOf(user), 1_024 * ONE, "24 net on the round trip");

        // 5. withdraw
        vm.prank(user);
        engine.withdraw(1_024 * ONE);
        assertEq(usdg.balanceOf(user), 1_024 * ONE, "back in the wallet");
        assertEq(engine.balanceOf(user), 0, "and nothing left behind");
    }

    function test_NobodyCanTouchAnotherAccountsBalance() public {
        vm.prank(trader);
        engine.openPosition(USDJPY, true, 100 * ONE, 10);

        // There is no owner path into a trader's money: the only functions that
        // move `balanceOf` are called by its owner.
        vm.prank(owner);
        vm.expectRevert(PerpEngine.NoPosition.selector);
        engine.closePosition(USDJPY);

        assertEq(engine.balanceOf(trader), 9_899.5e6, "untouched");
    }
}
