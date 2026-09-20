// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {PythOracle} from "../src/oracle/PythOracle.sol";
import {MarketTable} from "./MarketTable.sol";

/**
 * @title SetFeeds
 * @notice Points each listed market at the Pyth feed that prices it.
 *
 * **The feed ids are not written into this repository by hand.** They come
 * from `feeds.json`, which the keeper generates by asking Pyth what it
 * publishes — a hardcoded 32-byte id that turns out to belong to a different
 * pair is the kind of mistake that is only discovered by somebody losing
 * money on it.
 *
 * A market missing from `feeds.json` is skipped and named in the log. That is
 * the expected case: Pyth covers the majors and a good part of the emerging
 * markets, and almost none of the frontier currencies, so part of the table
 * stays unpriced until a second source is wired in. An unpriced market has no
 * feed, so every call to it reverts, which is the correct failure.
 *
 * Usage:
 *   forge script script/SetFeeds.s.sol:SetFeeds \
 *     --rpc-url $TESTNET_RPC_URL --private-key $DEPLOYER_KEY --broadcast
 */
contract SetFeeds is Script {
    using stdJson for string;

    function run() external {
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        uint32 maxAge = uint32(vm.envOr("ORACLE_MAX_AGE", uint256(60)));
        uint32 maxConfidenceBps = uint32(vm.envOr("ORACLE_MAX_CONFIDENCE_BPS", uint256(50)));

        string memory json = vm.readFile("./script/feeds.json");
        PythOracle oracle = PythOracle(oracleAddress);

        MarketTable.Row[] memory table = MarketTable.rows();

        vm.startBroadcast();

        uint256 wired;
        for (uint256 i = 0; i < table.length; i++) {
            string memory symbol = table[i].symbol;
            string memory pointer = string.concat(".", symbol);

            if (!json.keyExists(pointer)) {
                console2.log("skipped, no Pyth feed:", symbol);
                continue;
            }

            oracle.setFeed(
                keccak256(bytes(symbol)),
                json.readBytes32(string.concat(pointer, ".id")),
                maxAge,
                maxConfidenceBps,
                json.readBool(string.concat(pointer, ".invert"))
            );
            wired++;
        }

        vm.stopBroadcast();

        console2.log("feeds wired", wired);
        console2.log("markets still unpriced", table.length - wired);
    }
}
