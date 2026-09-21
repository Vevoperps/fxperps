// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {PushOracle} from "../src/oracle/PushOracle.sol";

/**
 * @title SetPushOracle
 * @notice Puts up a `PushOracle`, names the keeper as its publisher, and
 *         points the already-deployed engine at it.
 *
 * The engine does not have to be redeployed for this: `setOracle` is one of
 * the four things its owner may do, and swapping the price source is exactly
 * what that power is for. Positions, balances and the pool are untouched.
 *
 * Reads the engine's address from `deployments/<chainId>.json`, which the
 * deploy wrote, and overrides it with `ENGINE_ADDRESS` when that is set.
 *
 * Usage:
 *   forge script script/SetPushOracle.s.sol:SetPushOracle \
 *     --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
 */
contract SetPushOracle is Script {
    using stdJson for string;

    /// @dev Five minutes. The source refreshes about once a minute; this
    /// leaves room for a missed round without opening the book to a stale one.
    uint32 private constant DEFAULT_MAX_AGE = 300;

    /// @dev 5%. Wide enough for a real move on a frontier currency, narrow
    /// enough that a stolen publisher key cannot print a mark at zero.
    uint32 private constant DEFAULT_MAX_DEVIATION_BPS = 500;

    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    function _engineAddress() private view returns (address) {
        string memory fromEnv = vm.envOr("ENGINE_ADDRESS", string(""));
        if (bytes(fromEnv).length != 0) return vm.parseAddress(fromEnv);

        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        return record.readAddress(".engine");
    }

    function run() external {
        uint256 key = _deployerKey();
        address deployer = vm.addr(key);
        address engineAddress = _engineAddress();

        // The address that will post marks. Defaults to the deployer, which is
        // convenient and wrong for anything but a testnet: the publisher key
        // lives in a keeper that runs unattended, and the deployer owns the
        // venue.
        address publisher = vm.envOr("KEEPER_ADDRESS", deployer);

        uint32 maxAge = uint32(vm.envOr("ORACLE_MAX_AGE", uint256(DEFAULT_MAX_AGE)));
        uint32 maxDeviationBps = uint32(vm.envOr("ORACLE_MAX_DEVIATION_BPS", uint256(DEFAULT_MAX_DEVIATION_BPS)));

        vm.startBroadcast(key);

        PushOracle oracle = new PushOracle(deployer, maxAge, maxDeviationBps);
        oracle.setPublisher(publisher, true);

        PerpEngine engine = PerpEngine(engineAddress);
        engine.setOracle(IOracle(address(oracle)));

        vm.stopBroadcast();

        console2.log("PushOracle       ", address(oracle));
        console2.log("  publisher      ", publisher);
        console2.log("  maxAge         ", maxAge);
        console2.log("  maxDeviationBps", maxDeviationBps);
        console2.log("engine now reads it:", engineAddress);
        console2.log("!! marks on this oracle are POSTED, not signed. The publisher decides the price.");

        _record(address(oracle), publisher);
    }

    /// @dev Merged into the deployment record rather than replacing it: the
    /// engine and the settlement token did not move.
    function _record(address oracle, address publisher) private {
        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        string memory existing = vm.readFile(path);

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "engine", existing.readAddress(".engine"));
        vm.serializeAddress(key, "settlement", existing.readAddress(".settlement"));
        vm.serializeAddress(key, "oracle", oracle);
        vm.serializeString(key, "oracleKind", "push");
        vm.serializeAddress(key, "publisher", publisher);
        string memory out = vm.serializeUint(key, "deployedAt", block.timestamp);

        vm.writeJson(out, path);
    }
}
