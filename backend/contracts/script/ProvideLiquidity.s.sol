// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {PerpEngine} from "../src/PerpEngine.sol";

/**
 * @title ProvideLiquidity
 * @notice Backs the book with settlement tokens the provider already owns.
 *
 * The mainnet counterpart of `SeedLiquidity`, and the difference between them
 * is the whole point: that one mints what it deposits, because the testnet
 * token is a mock with an open faucet. Here nothing is minted. The tokens come
 * out of the caller's balance, and if the balance is short the script says so
 * before it broadcasts anything rather than reverting halfway through an
 * approval.
 *
 * The venue is peer-to-pool: it is the counterparty to every trade, and each
 * open position reserves its payout cap out of the pool before it opens. An
 * empty pool is a venue where the first `openPosition` reverts — so this runs
 * once after the deploy, and again whenever the book outgrows its backing.
 *
 * Usage, from `backend/contracts`, amount in whole tokens:
 *   $env:POOL_LIQUIDITY = "25000"
 *   forge script script/ProvideLiquidity.s.sol:ProvideLiquidity \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
interface ISettlement {
    function decimals() external view returns (uint8);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract ProvideLiquidity is Script {
    using stdJson for string;

    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    function run() external {
        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        PerpEngine engine = PerpEngine(record.readAddress(".engine"));
        ISettlement settlement = ISettlement(record.readAddress(".settlement"));

        uint256 key = _deployerKey();
        address provider = vm.addr(key);

        uint8 decimals = settlement.decimals();
        uint256 amount = vm.envUint("POOL_LIQUIDITY") * 10 ** decimals;

        // Checked before the broadcast, so a short balance costs nothing and
        // reads as a sentence rather than as a revert inside `transferFrom`.
        uint256 held = settlement.balanceOf(provider);
        require(held >= amount, "ProvideLiquidity: provider balance is below POOL_LIQUIDITY");

        console2.log("settlement    ", address(settlement));
        console2.log("decimals      ", decimals);
        console2.log("provider      ", provider);
        console2.log("provider holds", held);
        console2.log("depositing    ", amount);

        vm.startBroadcast(key);

        // Exact, not unlimited. A script run once from a deployer key has no
        // reason to leave a standing allowance behind it.
        if (settlement.allowance(provider, address(engine)) < amount) {
            settlement.approve(address(engine), amount);
        }
        uint256 shares = engine.addLiquidity(amount);

        vm.stopBroadcast();

        console2.log("shares        ", shares);
        console2.log("pool assets   ", engine.poolAssets());
        console2.log("pool free     ", engine.poolFree());
    }
}
