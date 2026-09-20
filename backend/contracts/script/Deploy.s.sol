// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {IPyth} from "../src/interfaces/IPyth.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {PythOracle} from "../src/oracle/PythOracle.sol";
import {MarketTable} from "./MarketTable.sol";

/**
 * @title Deploy
 * @notice Stands the venue up and lists every pair the site knows about.
 *
 * The script is written so that the same command works on a fork, a testnet
 * and mainnet, and the difference between them is entirely in the `.env`:
 *
 *  - `USDG_ADDRESS` empty  -> a MockUSDG with an open faucet goes up instead.
 *  - `PYTH_ADDRESS` empty  -> a MockOracle goes up instead, which the keeper
 *                             writes into. Feeds are wired afterwards by
 *                             `SetFeeds.s.sol`.
 *
 * Both fallbacks print a loud line. A venue that silently settled real money
 * against a price its own operator can set is not a venue.
 *
 * Usage (see backend/contracts/README.md for the full walk-through):
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $TESTNET_RPC_URL --private-key $DEPLOYER_KEY --broadcast
 */
contract Deploy is Script {
    function run() external {
        address usdgAddress = vm.envOr("USDG_ADDRESS", address(0));
        address pythAddress = vm.envOr("PYTH_ADDRESS", address(0));

        vm.startBroadcast();

        address deployer = msg.sender;

        if (usdgAddress == address(0)) {
            usdgAddress = address(new MockUSDG());
            console2.log("!! MOCK settlement token deployed. Testnet only.", usdgAddress);
        }

        IOracle oracle;
        if (pythAddress == address(0)) {
            oracle = IOracle(address(new MockOracle(deployer)));
            console2.log("!! MOCK oracle deployed. Prices are operator-set. Testnet only.", address(oracle));
        } else {
            oracle = IOracle(address(new PythOracle(IPyth(pythAddress), deployer)));
            console2.log("Pyth oracle", address(oracle));
        }

        PerpEngine engine = new PerpEngine(IERC20(usdgAddress), oracle, deployer);
        console2.log("PerpEngine", address(engine));

        uint256 unit = 10 ** IERC20(usdgAddress).decimals();

        MarketTable.Row[] memory table = MarketTable.rows();
        for (uint256 i = 0; i < table.length; i++) {
            MarketTable.Row memory row = table[i];
            engine.listMarket(
                keccak256(bytes(row.symbol)),
                row.maxLeverage,
                uint128(row.skewScale * unit),
                uint128(row.maxOpenInterest * unit),
                uint128(row.minMargin * unit)
            );
        }
        console2.log("markets listed", table.length);

        vm.stopBroadcast();

        _record(address(engine), address(oracle), usdgAddress, pythAddress == address(0));
    }

    /// @dev A deployment nobody wrote down is a deployment nobody can verify.
    function _record(address engine, address oracle, address settlement, bool mockOracle) private {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "engine", engine);
        vm.serializeAddress(key, "oracle", oracle);
        vm.serializeAddress(key, "settlement", settlement);
        vm.serializeUint(key, "deployedAt", block.timestamp);
        string memory out = vm.serializeBool(key, "mockOracle", mockOracle);

        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
