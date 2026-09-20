// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MarketTable
 * @notice Every pair the venue lists, and what each one is allowed to do.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: src/lib/markets.ts. Regenerate with `node tools/gen-market-table.mjs`.
 *
 * Sizes are in whole settlement dollars; the deploy script scales them by the
 * settlement token's own decimals, so this table never has to know them.
 */
library MarketTable {
    struct Row {
        string symbol;
        uint32 maxLeverage;
        uint128 skewScale;
        uint128 maxOpenInterest;
        uint128 minMargin;
        /// @dev A plausible mid, 1e18. Only ever used to seed a local chain.
        uint256 seedPrice;
    }

    uint256 internal constant COUNT = 64;

    function rows() internal pure returns (Row[] memory table) {
        table = new Row[](COUNT);

        table[ 0] = Row({
            symbol: "USDJPY",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 147310000000000000000
        }); // Japan
        table[ 1] = Row({
            symbol: "USDEUR",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 918200000000000000
        }); // Euro area
        table[ 2] = Row({
            symbol: "USDGBP",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 778400000000000000
        }); // UK
        table[ 3] = Row({
            symbol: "USDCHF",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 846100000000000000
        }); // Switzerland
        table[ 4] = Row({
            symbol: "USDCAD",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 1374200000000000000
        }); // Canada
        table[ 5] = Row({
            symbol: "USDAUD",
            maxLeverage: 25,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 1513300000000000000
        }); // Australia
        table[ 6] = Row({
            symbol: "USDNZD",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 1660400000000000000
        }); // New Zealand
        table[ 7] = Row({
            symbol: "USDSEK",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 10412000000000000000
        }); // Sweden
        table[ 8] = Row({
            symbol: "USDNOK",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 10733000000000000000
        }); // Norway
        table[ 9] = Row({
            symbol: "USDDKK",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 6847100000000000000
        }); // Denmark
        table[10] = Row({
            symbol: "USDCNY",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 7120400000000000000
        }); // China
        table[11] = Row({
            symbol: "USDHKD",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 7790200000000000000
        }); // Hong Kong
        table[12] = Row({
            symbol: "USDSGD",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 1287100000000000000
        }); // Singapore
        table[13] = Row({
            symbol: "USDKRW",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 1342800000000000000000
        }); // Korea
        table[14] = Row({
            symbol: "USDTWD",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 31842000000000000000
        }); // Taiwan
        table[15] = Row({
            symbol: "USDINR",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 87214000000000000000
        }); // India
        table[16] = Row({
            symbol: "USDTHB",
            maxLeverage: 12,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 33517000000000000000
        }); // Thailand
        table[17] = Row({
            symbol: "USDIDR",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 16284000000000000000000
        }); // Indonesia
        table[18] = Row({
            symbol: "USDMYR",
            maxLeverage: 12,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 4218300000000000000
        }); // Malaysia
        table[19] = Row({
            symbol: "USDPHP",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 57412000000000000000
        }); // Philippines
        table[20] = Row({
            symbol: "USDVND",
            maxLeverage: 8,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 25384000000000000000000
        }); // Vietnam
        table[21] = Row({
            symbol: "USDPKR",
            maxLeverage: 6,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 278410000000000000000
        }); // Pakistan
        table[22] = Row({
            symbol: "USDBDT",
            maxLeverage: 6,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 119820000000000000000
        }); // Bangladesh
        table[23] = Row({
            symbol: "USDKZT",
            maxLeverage: 6,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 478210000000000000000
        }); // Kazakhstan
        table[24] = Row({
            symbol: "USDMNT",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 3418200000000000000000
        }); // Mongolia
        table[25] = Row({
            symbol: "USDPLN",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 3912400000000000000
        }); // Poland
        table[26] = Row({
            symbol: "USDCZK",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 22841000000000000000
        }); // Czechia
        table[27] = Row({
            symbol: "USDHUF",
            maxLeverage: 12,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 361420000000000000000
        }); // Hungary
        table[28] = Row({
            symbol: "USDRON",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 4571200000000000000
        }); // Romania
        table[29] = Row({
            symbol: "USDTRY",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 38412000000000000000
        }); // Turkey
        table[30] = Row({
            symbol: "USDUAH",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 41284000000000000000
        }); // Ukraine
        table[31] = Row({
            symbol: "USDAMD",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 387210000000000000000
        }); // Armenia
        table[32] = Row({
            symbol: "USDMXN",
            maxLeverage: 12,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 18412000000000000000
        }); // Mexico
        table[33] = Row({
            symbol: "USDBRL",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 5421800000000000000
        }); // Brazil
        table[34] = Row({
            symbol: "USDARS",
            maxLeverage: 3,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 1284200000000000000000
        }); // Argentina
        table[35] = Row({
            symbol: "USDCLP",
            maxLeverage: 8,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 941280000000000000000
        }); // Chile
        table[36] = Row({
            symbol: "USDCOP",
            maxLeverage: 6,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 4182400000000000000000
        }); // Colombia
        table[37] = Row({
            symbol: "USDPEN",
            maxLeverage: 8,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 3712400000000000000
        }); // Peru
        table[38] = Row({
            symbol: "USDUYU",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 40218000000000000000
        }); // Uruguay
        table[39] = Row({
            symbol: "USDPYG",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 7681200000000000000000
        }); // Paraguay
        table[40] = Row({
            symbol: "USDDOP",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 60412000000000000000
        }); // Dominican Republic
        table[41] = Row({
            symbol: "USDCRC",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 512840000000000000000
        }); // Costa Rica
        table[42] = Row({
            symbol: "USDJMD",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 157210000000000000000
        }); // Jamaica
        table[43] = Row({
            symbol: "USDGTQ",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 7712400000000000000
        }); // Guatemala
        table[44] = Row({
            symbol: "USDSAR",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 3750300000000000000
        }); // Saudi Arabia
        table[45] = Row({
            symbol: "USDAED",
            maxLeverage: 20,
            skewScale: 2_000_000,
            maxOpenInterest: 5_000_000,
            minMargin: 10,
            seedPrice: 3672500000000000000
        }); // United Arab Emirates
        table[46] = Row({
            symbol: "USDQAR",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 3641200000000000000
        }); // Qatar
        table[47] = Row({
            symbol: "USDKWD",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 306200000000000000
        }); // Kuwait
        table[48] = Row({
            symbol: "USDBHD",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 377100000000000000
        }); // Bahrain
        table[49] = Row({
            symbol: "USDOMR",
            maxLeverage: 15,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 384500000000000000
        }); // Oman
        table[50] = Row({
            symbol: "USDJOD",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 709100000000000000
        }); // Jordan
        table[51] = Row({
            symbol: "USDILS",
            maxLeverage: 10,
            skewScale: 500_000,
            maxOpenInterest: 1_000_000,
            minMargin: 10,
            seedPrice: 3628400000000000000
        }); // Israel
        table[52] = Row({
            symbol: "USDZAR",
            maxLeverage: 8,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 17842000000000000000
        }); // South Africa
        table[53] = Row({
            symbol: "USDNGN",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 1541200000000000000000
        }); // Nigeria
        table[54] = Row({
            symbol: "USDEGP",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 48412000000000000000
        }); // Egypt
        table[55] = Row({
            symbol: "USDKES",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 129180000000000000000
        }); // Kenya
        table[56] = Row({
            symbol: "USDGHS",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 12418000000000000000
        }); // Ghana
        table[57] = Row({
            symbol: "USDMAD",
            maxLeverage: 8,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 9841200000000000000
        }); // Morocco
        table[58] = Row({
            symbol: "USDTND",
            maxLeverage: 5,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 3128400000000000000
        }); // Tunisia
        table[59] = Row({
            symbol: "USDDZD",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 134210000000000000000
        }); // Algeria
        table[60] = Row({
            symbol: "USDTZS",
            maxLeverage: 3,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 2684200000000000000000
        }); // Tanzania
        table[61] = Row({
            symbol: "USDUGX",
            maxLeverage: 3,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 3712800000000000000000
        }); // Uganda
        table[62] = Row({
            symbol: "USDZMW",
            maxLeverage: 3,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 26412000000000000000
        }); // Zambia
        table[63] = Row({
            symbol: "USDMUR",
            maxLeverage: 4,
            skewScale: 100_000,
            maxOpenInterest: 250_000,
            minMargin: 10,
            seedPrice: 46218000000000000000
        }); // Mauritius
    }
}
