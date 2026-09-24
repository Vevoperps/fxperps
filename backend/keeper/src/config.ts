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

  /**
   * Which oracle the engine is reading, and therefore what the price loop
   * does each round.
   *
   *  - `pyth` fetches Pyth's signed updates and pays the chain to verify them.
   *  - `push` fetches conventional FX rates and posts them to a `PushOracle`,
   *    where this keeper is the named publisher and decides the mark.
   *  - `mock` writes parsed Pyth prices into a `MockOracle`.
   *
   * Left unset it is inferred the way it always was: Pyth when a
   * `PYTH_ADDRESS` is configured, the mock when it is not.
   */
  ORACLE_KIND: z.enum(["pyth", "push", "mock"]).optional(),

  PRICE_INTERVAL: seconds.default(15),
  LIQUIDATION_INTERVAL: seconds.default(20),
  SNAPSHOT_INTERVAL: seconds.default(1200),
  START_BLOCK: z.coerce.number().int().nonnegative().default(0),

  HERMES_URL: z.string().url().default("https://hermes.pyth.network"),
  // Pyth closed the public Hermes API on 2026-08-26. Optional here rather than
  // required, because a deployment on the mock oracle never calls Hermes at
  // all — the price loop names the missing key itself when it needs one.
  PYTH_API_KEY: z.string().trim().min(1).optional(),

  /**
   * The conventional FX source behind `ORACLE_KIND=push`, quoted base=USD.
   *
   * It signs nothing and it is not an oracle — it is a rate feed this keeper
   * chooses to believe. Swapping it is a one-line change here; swapping what
   * that means for the venue is not.
   */
  FX_URL: z.string().url().default("https://api.fxratesapi.com/latest"),

  /**
   * How far a rate must move before it is worth a transaction, in bps.
   *
   * A currency pair that has not moved since the last round does not need its
   * mark rewritten, and rewriting it anyway is how a keeper spends a day's gas
   * on storing the same number sixty-four times a minute. Anything still fresh
   * and unchanged is left alone; see `prices.ts` for the other half of the
   * rule, which refreshes a mark before it can go stale regardless.
   */
  MIN_MOVE_BPS: z.coerce.number().int().nonnegative().default(2),

  /**
   * The pairs whose mark is kept fresh on chain no matter what.
   *
   * A mark only has to be on chain for a market somebody is about to trade or
   * is already in. The other sixty-odd are browsed, not filled, and the rates
   * a visitor browses come from the same feed this keeper reads — no
   * transaction required. Keeping all of them warm costs a full refresh of
   * every pair twice a staleness window, forever, whether anyone trades or
   * not, and that is the single largest line in this venue's running cost.
   *
   * So the keeper writes only what matters: whatever carries open interest,
   * plus this list, so the doors a visitor is most likely to walk through are
   * already open when they arrive.
   */
  ALWAYS_FRESH: z
    .string()
    .default("USDJPY,USDEUR,USDGBP")
    .transform((value) =>
      value
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0),
    ),

  /**
   * How often the open-interest read behind that set is refreshed, in seconds.
   *
   * It is one `eth_call` for all sixty-four markets, so this is cheap; it is
   * cached only so a fifteen-second price loop does not make the same call
   * four times a minute for an answer that changes when somebody opens a
   * position.
   */
  ACTIVE_REFRESH: z.coerce.number().int().positive().default(120),
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

/** What the price loop posts, and where. */
export const oracleKind: "pyth" | "push" | "mock" =
  config.ORACLE_KIND ?? (config.PYTH_ADDRESS === undefined ? "mock" : "pyth");

/** True when the mark is set by an operator rather than verified on chain. */
export const operatorSetMarks = oracleKind !== "pyth";

/** Kept for the existing call sites. */
export const usingMockOracle = oracleKind === "mock";
