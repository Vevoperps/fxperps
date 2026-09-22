// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {IERC20} from "../src/interfaces/IERC20.sol";
import {MarketTable} from "./MarketTable.sol";

/**
 * @title ListMarkets
 * @notice Lists every market in the table that the engine does not have yet.
 *
 * **Why this exists rather than `forge script --resume`.** A resume replays the
 * saved broadcast with the nonces it recorded, so the moment the account's
 * nonce moves for any other reason the file is stale and every retry fails on
 * the same number, having sent nothing. This reads the engine instead: it asks
 * which markets are listed, diffs that against the table, and sends the
 * difference with whatever nonce the chain is on. Interrupt it, run it again,
 * run it twice — it converges on the same place.
 *
 * `listMarket` reverts with `AlreadyListed` on a duplicate, so the skip is not
 * an optimisation. Without it the first already-listed market kills the run.
 *
 * Usage, from `backend/contracts`:
 *   forge script script/ListMarkets.s.sol:ListMarkets \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --slow
 */
interface IEngineMarkets {
    function marketCount() external view returns (uint256);
    function marketIds(uint256 index) external view returns (bytes32);
    function listMarket(
        bytes32 market,
        uint32 maxLeverage,
        uint128 skewScale,
        uint128 maxOpenInterest,
        uint128 minMargin
    ) external;
}

contract ListMarkets is Script {
    using stdJson for string;

    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    function run() external {
        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        IEngineMarkets engine = IEngineMarkets(record.readAddress(".engine"));
        IERC20 settlement = IERC20(record.readAddress(".settlement"));

        // What the engine already holds. Read before the broadcast, so the
        // whole plan is printed before a single transaction is signed.
        uint256 onChain = engine.marketCount();
        bytes32[] memory listed = new bytes32[](onChain);
        for (uint256 i = 0; i < onChain; i++) {
            listed[i] = engine.marketIds(i);
        }

        MarketTable.Row[] memory table = MarketTable.rows();
        uint256 unit = 10 ** settlement.decimals();

        console2.log("engine        ", address(engine));
        console2.log("listed already", onChain);
        console2.log("table holds   ", table.length);

        uint256 key = _deployerKey();
        vm.startBroadcast(key);

        uint256 added;
        for (uint256 i = 0; i < table.length; i++) {
            MarketTable.Row memory row = table[i];
            bytes32 id = keccak256(bytes(row.symbol));

            bool already;
            for (uint256 j = 0; j < listed.length; j++) {
                if (listed[j] == id) {
                    already = true;
                    break;
                }
            }
            if (already) continue;

            engine.listMarket(
                id,
                row.maxLeverage,
                uint128(row.skewScale * unit),
                uint128(row.maxOpenInterest * unit),
                uint128(row.minMargin * unit)
            );
            added++;
        }

        vm.stopBroadcast();

        console2.log("markets added ", added);
        console2.log("run again to confirm it reports 0 added.");
    }
}
