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
 * Usage. The deployer key is read from `.env`, never passed on the command
 * line:
 *   forge script script/SetFeeds.s.sol:SetFeeds \
 *     --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
 */
contract SetFeeds is Script {
    using stdJson for string;

    /// @dev The deployer key from `.env`, with or without its `0x` prefix.
    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    /**
     * @dev The oracle to wire, from `.env` or from the deploy's own record.
     *
     * `Deploy.s.sol` writes `deployments/<chainId>.json` precisely so the
     * address does not have to be copied by hand between two commands run
     * minutes apart. `ORACLE_ADDRESS` still wins when it is set, for wiring an
     * oracle this machine did not deploy.
     */
    function _oracleAddress() private view returns (address) {
        string memory fromEnv = vm.envOr("ORACLE_ADDRESS", string(""));
        if (bytes(fromEnv).length != 0) return vm.parseAddress(fromEnv);

        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        return record.readAddress(".oracle");
    }

    function run() external {
        address oracleAddress = _oracleAddress();
        uint32 maxAge = uint32(vm.envOr("ORACLE_MAX_AGE", uint256(60)));
        uint32 maxConfidenceBps = uint32(vm.envOr("ORACLE_MAX_CONFIDENCE_BPS", uint256(50)));

        string memory json = vm.readFile("./script/feeds.json");
        PythOracle oracle = PythOracle(oracleAddress);

        MarketTable.Row[] memory table = MarketTable.rows();

        // From `.env`, for the same reason as the deploy script: a key on the
        // command line is a key in the shell's history. `0x` optional, because
        // that is how wallets export it.
        vm.startBroadcast(_deployerKey());

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
