// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MarketTable} from "./MarketTable.sol";

/**
 * @title Seed
 * @notice A whole venue on a local chain, in one command.
 *
 * This is what unblocks the first milestone without waiting on anybody: a
 * settlement token with an open faucet, an oracle carrying a plausible mid for
 * all 64 pairs, every market listed with its real leverage cap, and a pool
 * with enough liquidity to back a few positions. Point the app at it and the
 * whole path — connect, deposit, open, watch the PNL, close, withdraw — works
 * end to end on your own machine.
 *
 * It is local-only and says so: it refuses to run on any chain but Anvil's.
 *
 * ```
 * anvil
 * forge script script/Seed.s.sol:Seed --rpc-url http://127.0.0.1:8545 \
 *   --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
 * ```
 *
 * That key is Anvil's own first account, printed by Anvil on every start. It
 * is public, worthless, and must never be used anywhere else.
 */
contract Seed is Script {
    /// @dev Anvil. Nothing else.
    uint256 private constant LOCAL_CHAIN = 31337;

    /// @dev Settlement dollars put behind the book, and handed to the faucet.
    uint256 private constant LIQUIDITY = 5_000_000;
    uint256 private constant FAUCET = 100_000;

    function run() external {
        require(block.chainid == LOCAL_CHAIN, "Seed: local chain only");

        vm.startBroadcast();
        address deployer = msg.sender;

        MockUSDG usdg = new MockUSDG();
        MockOracle oracle = new MockOracle(deployer);
        PerpEngine engine = new PerpEngine(IERC20(address(usdg)), IOracle(address(oracle)), deployer);

        uint256 unit = 10 ** usdg.decimals();

        MarketTable.Row[] memory table = MarketTable.rows();
        for (uint256 i = 0; i < table.length; i++) {
            bytes32 market = keccak256(bytes(table[i].symbol));

            oracle.setPrice(market, table[i].seedPrice);
            engine.listMarket(
                market,
                table[i].maxLeverage,
                uint128(table[i].skewScale * unit),
                uint128(table[i].maxOpenInterest * unit),
                uint128(table[i].minMargin * unit)
            );
        }

        usdg.mint(deployer, (LIQUIDITY + FAUCET) * unit);
        usdg.approve(address(engine), type(uint256).max);
        engine.addLiquidity(LIQUIDITY * unit);

        vm.stopBroadcast();

        console2.log("");
        console2.log("  settlement  ", address(usdg));
        console2.log("  oracle      ", address(oracle));
        console2.log("  engine      ", address(engine));
        console2.log("  markets     ", table.length);
        console2.log("  liquidity   ", LIQUIDITY);
        console2.log("");
        console2.log("Put these in the site's .env.local:");
        console2.log("  NEXT_PUBLIC_CHAIN_ID=31337");
        console2.log("  NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545");
        console2.log("  NEXT_PUBLIC_ENGINE_ADDRESS=", address(engine));
        console2.log("  NEXT_PUBLIC_SETTLEMENT_ADDRESS=", address(usdg));
        console2.log("");
        console2.log("MockUSDG.mint is open to anyone, so any wallet can fund itself.");
    }
}
