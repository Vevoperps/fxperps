import {z} from "zod";

/**
 * The environment, validated once at start-up.
 *
 * A keeper that boots with a blank `ENGINE_ADDRESS` and discovers it forty
 * minutes later, halfway through a liquidation, is a keeper that has already
 * cost somebody money. Everything it needs is checked here, before it opens a
 * connection.
 */

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected a 20-byte address");
const seconds = z.coerce.number().int().positive();

const schema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive(),
  KEEPER_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected a 32-byte private key"),

  ENGINE_ADDRESS: address,
  ORACLE_ADDRESS: address,
  PYTH_ADDRESS: address.optional().or(z.literal("").transform(() => undefined)),

  PRICE_INTERVAL: seconds.default(15),
  LIQUIDATION_INTERVAL: seconds.default(20),
  SNAPSHOT_INTERVAL: seconds.default(1200),
  START_BLOCK: z.coerce.number().int().nonnegative().default(0),

  HERMES_URL: z.string().url().default("https://hermes.pyth.network"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("bad environment:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nsee .env.example, and remember: node --env-file=.env dist/index.js");
  process.exit(1);
}

export const config = parsed.data;

/** True when the deployment is running on the operator-set mock oracle. */
export const usingMockOracle = config.PYTH_ADDRESS === undefined;
