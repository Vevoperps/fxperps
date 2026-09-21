// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";

/**
 * @title SeedLiquidity
 * @notice Puts the first settlement tokens behind the book.
 *
 * The venue is peer-to-pool: it is the counterparty to every trade, and every
 * open position has its payout cap reserved out of the pool before it opens.
 * With an empty pool the very first `openPosition` reverts on that
 * reservation — so a deployment nobody has provided liquidity to is a
 * deployment where nothing trades at all, whatever the prices say.
 *
 * **Testnet only, and it refuses to be anything else.** It mints its own
 * settlement tokens, which is possible because the token is a mock with an
 * open faucet. Against a real USDG the mint reverts, which is the correct
 * failure: liquidity on mainnet comes from providers who bought the token.
 *
 * Usage:
 *   forge script script/SeedLiquidity.s.sol:SeedLiquidity \
 *     --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
 */
contract SeedLiquidity is Script {
    using stdJson for string;

    /// @dev Settlement dollars, before decimals. Override with POOL_LIQUIDITY.
    uint256 private constant DEFAULT_LIQUIDITY = 1_000_000;

    /// @dev Robinhood Chain. Named so the refusal reads as a decision.
    uint256 private constant MAINNET = 4663;

    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    function run() external {
        require(block.chainid != MAINNET, "SeedLiquidity: testnet only");

        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        PerpEngine engine = PerpEngine(record.readAddress(".engine"));
        MockUSDG usdg = MockUSDG(record.readAddress(".settlement"));

        uint256 key = _deployerKey();
        address provider = vm.addr(key);

        uint256 amount = vm.envOr("POOL_LIQUIDITY", DEFAULT_LIQUIDITY) * 10 ** usdg.decimals();

        vm.startBroadcast(key);

        usdg.mint(provider, amount);
        usdg.approve(address(engine), amount);
        uint256 shares = engine.addLiquidity(amount);

        vm.stopBroadcast();

        console2.log("liquidity added ", amount);
        console2.log("shares to       ", provider);
        console2.log("shares          ", shares);
        console2.log("pool assets     ", engine.poolAssets());
        console2.log("pool free       ", engine.poolFree());
        console2.log("!! MOCK settlement token. These are not dollars.");
    }
}
