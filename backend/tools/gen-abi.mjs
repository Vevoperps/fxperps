/**
 * Copies the ABIs out of Foundry's build into the one place the Node services
 * read them from.
 *
 * The keeper and the site both talk to the engine, and an ABI that has drifted
 * from the contract fails as a silent decode rather than as an error anyone
 * can read. So nothing hand-writes one: build the contracts, run this, commit
 * the result.
 *
 * Run from `backend/`:  cd contracts && forge build && cd .. && node tools/gen-abi.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import {createRequire} from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../contracts/out");
const TARGET = path.resolve(HERE, "../shared/abi");
const SITE = path.resolve(HERE, "../../src/lib/chain/abi.ts");

const WANTED = ["PerpEngine", "PythOracle", "MockOracle", "MockUSDG"];

if (!fs.existsSync(OUT)) {
  console.error("no contracts/out — run `forge build` in backend/contracts first");
  process.exit(1);
}

fs.mkdirSync(TARGET, {recursive: true});

const abis = {};

for (const name of WANTED) {
  const artifact = path.join(OUT, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(artifact)) {
    console.error(`missing ${path.relative(process.cwd(), artifact)}`);
    process.exit(1);
  }

  const {abi} = JSON.parse(fs.readFileSync(artifact, "utf8"));
  abis[name] = abi;
  fs.writeFileSync(path.join(TARGET, `${name}.json`), `${JSON.stringify(abi, null, 2)}\n`);
  console.log(`${name.padEnd(12)} ${abi.length} entries`);
}

writeSiteAbi(abis);

/**
 * The site gets the same ABIs in ethers' human-readable form.
 *
 * A 25 KB JSON blob in the bundle to call six functions is waste, and it is
 * unreadable in review — a diff that changes a function's arguments should be
 * one line anyone can check, not forty lines of `{"internalType": ...}`.
 */
function writeSiteAbi(built) {
  const require = createRequire(path.resolve(HERE, "../../package.json"));

  let Interface;
  try {
    ({Interface} = require("ethers"));
  } catch {
    console.warn("ethers not installed at the repo root — skipped src/lib/chain/abi.ts");
    return;
  }

  const human = (name) =>
    new Interface(built[name])
      .format()
      .map((line) => `  ${JSON.stringify(line)},`)
      .join("\n");

  fs.mkdirSync(path.dirname(SITE), {recursive: true});
  fs.writeFileSync(
    SITE,
    `/**
 * The venue's ABIs, in ethers' human-readable form.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`node tools/gen-abi.mjs\` from \`backend/\`, after
 * \`forge build\`. The contracts are the source; this is a copy that ships.
 */

export const PERP_ENGINE_ABI = [
${human("PerpEngine")}
] as const;

/** Only the parts of the settlement token the app touches. */
export const SETTLEMENT_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

/** The testnet faucet. Present on MockUSDG only; absent on a real token. */
export const FAUCET_ABI = ["function mint(address to, uint256 amount)"] as const;
`,
  );

  console.log(`site abi    ${path.relative(process.cwd(), SITE)}`);
}
