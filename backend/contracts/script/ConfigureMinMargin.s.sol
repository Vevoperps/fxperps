// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {PerpEngine} from "../src/PerpEngine.sol";
import {MarketTable} from "./MarketTable.sol";

/**
 * @title ConfigureMinMargin
 * @notice Lowers the smallest margin a named market will accept, and changes
 *         nothing else about it.
 *
 * **Why this is a script and not three `cast send` calls.** `configureMarket`
 * takes the whole configuration, not a patch: leverage cap, skew scale, open
 * interest cap and minimum margin all go in together, and whatever is passed
 * becomes the market. Typing those by hand is four numbers, three of which
 * must come back exactly as they already are, two of which are scaled by the
 * settlement token's decimals. Getting one wrong does not revert. It silently
 * rewrites the funding curve of a live market. So the other three are read
 * from `MarketTable`, the same table the deploy listed them from, and only the
 * minimum moves.
 *
 * **Why the minimum matters at all.** Every open position reserves nine times
 * its margin out of the pool, fixed when it opens. A market listed at a
 * minimum of ten therefore cannot be traded at all until the pool holds ninety
 * free, whatever the trader is willing to risk. Lowering the minimum is what
 * makes a small pool usable.
 *
 * Usage, from `backend/contracts`. Symbols are the table's own, quoted base
 * USD, and the margin is in whole settlement dollars:
 *
 *   $env:MARKETS = "USDJPY,USDEUR,USDGBP"
 *   $env:MIN_MARGIN = "1"
 *   forge script script/ConfigureMinMargin.s.sol:ConfigureMinMargin `
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast --slow
 *
 * Running it twice is harmless: it writes the same configuration again.
 */
interface ISettlement {
    function decimals() external view returns (uint8);
}

contract ConfigureMinMargin is Script {
    using stdJson for string;

    function _deployerKey() private view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_KEY");
        bytes memory value = bytes(raw);

        bool prefixed = value.length > 1 && value[0] == "0" && (value[1] == "x" || value[1] == "X");
        return vm.parseUint(prefixed ? raw : string.concat("0x", raw));
    }

    /// @dev The table row carrying this symbol. Reverts rather than guessing.
    function _row(string memory symbol) private pure returns (MarketTable.Row memory) {
        MarketTable.Row[] memory table = MarketTable.rows();
        bytes32 wanted = keccak256(bytes(symbol));

        for (uint256 i = 0; i < table.length; i++) {
            if (keccak256(bytes(table[i].symbol)) == wanted) return table[i];
        }
        revert(string.concat("ConfigureMinMargin: unknown symbol ", symbol));
    }

    function run() external {
        string memory record = vm.readFile(string.concat("./deployments/", vm.toString(block.chainid), ".json"));
        PerpEngine engine = PerpEngine(record.readAddress(".engine"));
        uint256 unit = 10 ** ISettlement(record.readAddress(".settlement")).decimals();

        string[] memory symbols = vm.envString("MARKETS", ",");
        uint128 minMargin = uint128(vm.envUint("MIN_MARGIN") * unit);

        console2.log("engine    ", address(engine));
        console2.log("chain     ", block.chainid);
        console2.log("minMargin ", minMargin);

        uint256 key = _deployerKey();
        vm.startBroadcast(key);

        for (uint256 i = 0; i < symbols.length; i++) {
            MarketTable.Row memory row = _row(symbols[i]);

            engine.configureMarket(
                keccak256(bytes(row.symbol)),
                row.maxLeverage,
                uint128(row.skewScale * unit),
                uint128(row.maxOpenInterest * unit),
                minMargin
            );

            console2.log("configured", row.symbol);
        }

        vm.stopBroadcast();

        console2.log("markets   ", symbols.length);
    }
}
