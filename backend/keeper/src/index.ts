import {every, provider, signer} from "./chain.js";
import {config, usingMockOracle} from "./config.js";
import {sweep} from "./liquidator.js";
import {pushPrices} from "./prices.js";
import {takeSnapshots} from "./snapshots.js";
import {markets} from "./shared.js";

/**
 * The keeper.
 *
 * Three loops, all of them doing work anybody could do: post the prices Pyth
 * has signed, close positions that have fallen through their maintenance
 * margin, and refresh each market's 24h reference mark. It holds no custody,
 * decides no price, and cannot move a balance. If it stops,
 * the engine is still correct and somebody else can collect the liquidation
 * fees — which is the property to preserve as this grows.
 *
 * Run:  node --env-file=.env dist/index.js
 *       node --env-file=.env dist/index.js --once
 */

const once = process.argv.includes("--once");

const main = async (): Promise<void> => {
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(signer.address);

  console.log("vevo keeper");
  console.log(`  chain      ${network.chainId} (${config.CHAIN_ID} configured)`);
  console.log(`  engine     ${config.ENGINE_ADDRESS}`);
  console.log(`  oracle     ${config.ORACLE_ADDRESS}${usingMockOracle ? "  !! MOCK, testnet only" : ""}`);
  console.log(`  keeper     ${signer.address}`);
  console.log(`  gas        ${balance}`);
  console.log(`  markets    ${markets.length}`);

  if (network.chainId !== BigInt(config.CHAIN_ID)) {
    throw new Error(`RPC is chain ${network.chainId}, expected ${config.CHAIN_ID} — check RPC_URL`);
  }

  if (balance === 0n) {
    console.warn("  !! the keeper wallet holds no gas; every call will fail");
  }

  if (once) {
    await pushPrices();
    await sweep();
    await takeSnapshots();
    return;
  }

  await Promise.all([
    every(config.PRICE_INTERVAL, "prices", pushPrices),
    every(config.LIQUIDATION_INTERVAL, "liquidator", sweep),
    // The reference mark behind the 24h column. The contract refuses to move
    // it more than once a day, so checking every twenty minutes costs reads
    // and nothing else.
    every(config.SNAPSHOT_INTERVAL, "reference", takeSnapshots),
  ]);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
