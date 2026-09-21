# vevo — backend

The venue itself: the contracts that hold the money, the oracle adapter that
prices it, and the keeper that does the maintenance.

Every line of it is ours. The engine is built against the arithmetic the site
and the handbook already publish, so the ticket a trader reads and the
transaction they sign compute the same four numbers from the same constants.

```
backend/
  contracts/        Foundry. Solidity 0.8.24, evm_version = paris.
    src/
      PerpEngine.sol          the venue: balances, positions, pool, funding
      libraries/Funding.sol   skew -> rate, capped at 0.75% per 8h
      libraries/PositionMath.sol  pnl, equity, maintenance, liquidation, payout
      oracle/PythOracle.sol   Pyth feed -> one 1e18 mark, with inversion
      mocks/                  MockUSDG, MockOracle — testnet only
    test/PerpEngine.t.sol     the handbook, as assertions
    script/                   Deploy, SetFeeds, generated MarketTable
  keeper/           Node 22 + TypeScript. Posts prices, liquidates, keeps
                    each market's 24h reference mark fresh.
  shared/           Generated: markets.json and the ABIs. One source of truth.
  tools/            The generators that write shared/ and MarketTable.sol.
```

## How it works

**The venue is the counterparty.** There is no book. A trade fills at the
oracle's mark and the other side of it is a pool of settlement tokens that
liquidity providers own. That is what makes a frontier pair tradeable at three
in the morning, and it is what the payout cap is for: every open position has
the most it can ever return reserved out of the pool, so the number on the
ticket is backed rather than promised.

**One contract holds the money** and keeps four ledgers against it — trader
balances, positions, pool assets, pool reservations. Margin, payouts, fees and
funding all move between those four on the same token, and every contract
boundary in that path would be a transfer that can half-succeed.

**Custody stays with the trader.** No function lets the owner touch a balance,
no pause traps a withdrawal, and closing works on a paused market. The owner
lists markets and sets their parameters. That is the whole of the admin key.

**Maintenance is permissionless.** `poke`, `snapshot` and `liquidate` are open
to anyone, and a liquidator is paid out of what is left of the position. Our
keeper is a convenience, not a dependency.

**The 24h column comes off the chain, not an indexer.** Each market keeps one
reference mark that anybody may refresh once a day, and `referenceAt` travels
with it — so a front end can tell a fresh reference from a stale one and show a
dash rather than a change measured against last week.

### The arithmetic, in one place

The same numbers the site prints and the handbook states:

| | |
|---|---|
| Notional | margin × leverage |
| Fee | 0.05% of notional, each way |
| Funding | skew-driven, capped at ±0.75% per 8h, on notional, by the second |
| Maintenance | 0.5% of notional |
| Liquidation | `1/leverage − 0.005` from entry — 9.5% at 10x, 3.5% at 25x |
| Max payout | 10× margin, fixed at open, reserved until close |

`PositionMath.sol` is the single definition, and `test/PerpEngine.t.sol`
asserts every row of that table against the engine that has to honour it.

### Quoting convention, and why half the feeds are inverted

Every market here is **local currency per one dollar** — USDJPY, USDEUR,
USDTRY — because that is the number a trader reading a frontier pair wants and
it keeps all 64 pairs pointing the same way. The market does not agree: Pyth
publishes EUR/USD and GBP/USD the other way up. Those feeds carry an `invert`
flag and `PythOracle` takes the reciprocal, so the inversion lives in exactly
one place instead of four.

### Expect gaps in the feed coverage

Pyth covers the majors and a fair part of the emerging markets. It does not
cover most of the frontier currencies this venue lists. `resolve-feeds` reports
exactly which of the 64 it can price; the rest stay listed and **unpriced**,
which means every call to them reverts. That is the correct failure, and it is
a product decision to make before launch: drop them, or wire a second source
behind the same `IOracle` interface.

---

## Running it

### 0. Install Foundry (once)

```powershell
# Windows: use Git Bash or WSL for this one line
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 1. Contracts

```powershell
cd D:\dev\fxperps\backend\contracts
# forge-std is already vendored under lib/. Only if that folder is missing:
#   forge install foundry-rs/forge-std --no-git
copy .env.example .env
forge build
forge test -vvv
```

`forge test` is the gate. It checks the fee, the maintenance floor, both
liquidation distances, the funding cap, the payout cap, and — the one that
matters most — that the settlement tokens the contract holds equal every
ledger entry it claims.

### 2. The whole venue on your own machine, in two commands

This is the shortest route to the first milestone and it waits on nobody — no
USDG address, no RPC, no Pyth. One command stands the venue up on a local
chain; the app then reads it like any other.

```powershell
# terminal 1
anvil

# terminal 2
cd D:\dev\fxperps\backend\contracts
forge script script/Seed.s.sol:Seed --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

That key is Anvil's own first account, printed by Anvil on every start. It is
public, worthless, and must never be used anywhere else.

The script prints the four lines to paste into `D:\dev\fxperps\.env.local`:

```
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x...
```

Then `yarn dev`, add the local chain to your wallet, press **Faucet 10,000** on
the portfolio, and walk the whole path: deposit, open, watch the PNL, close,
withdraw. Every screen reads the contract; the banner turns red and says the
chain is a development one.

### 3. Deploy to testnet

Fill `.env` first. Leave `USDG_ADDRESS` and `PYTH_ADDRESS` blank on testnet and
the script puts up a mock token with an open faucet and an operator-set oracle,
and says so loudly.

```powershell
cd D:\dev\fxperps\backend\contracts
forge script script/Deploy.s.sol:Deploy --rpc-url $env:TESTNET_RPC_URL --private-key $env:DEPLOYER_KEY --broadcast
```

The addresses land in `deployments/<chainId>.json`.

### 4. Regenerate the shared table and the ABIs

```powershell
cd D:\dev\fxperps\backend
node tools/gen-market-table.mjs
node tools/gen-abi.mjs
```

Run the first one whenever `src/lib/markets.ts` changes, and the second one
after every `forge build`. Neither table is ever edited by hand.

### 5. Resolve the Pyth feeds

```powershell
cd D:\dev\fxperps\backend\keeper
copy .env.example .env
npm install
npm run build
npm run resolve-feeds
```

It asks Pyth what it publishes and writes `contracts/script/feeds.json`. It
prints how many of the 64 matched and names every one that did not. Read that
list before going further — it is the real coverage of the product.

Then, on a Pyth deployment:

```powershell
cd D:\dev\fxperps\backend\contracts
forge script script/SetFeeds.s.sol:SetFeeds --rpc-url $env:TESTNET_RPC_URL --private-key $env:DEPLOYER_KEY --broadcast
```

### 6. Keeper

```powershell
cd D:\dev\fxperps\backend\keeper
npm run build
node --env-file=.env dist/index.js --once   # one round, to see it work
node --env-file=.env dist/index.js          # the loops
```

Use a **throwaway wallet** for `KEEPER_KEY`, funded with gas and nothing else.
Never the deployer. Neither call the keeper makes can move anyone's balance, so
a stolen keeper key costs its gas and nothing more — which is only true as long
as it is a separate key.

### Railway

The keeper ships as a Dockerfile. Build context is `backend/`, not
`backend/keeper/`, because the image needs `shared/` beside the build.

```powershell
cd D:\dev\fxperps\backend
railway up
```

Environment variables to set in Railway: `RPC_URL`, `CHAIN_ID`, `KEEPER_KEY`,
`ENGINE_ADDRESS`, `ORACLE_ADDRESS`, `PYTH_ADDRESS`, `START_BLOCK`,
`PRICE_INTERVAL`, `LIQUIDATION_INTERVAL`, `HERMES_URL`.

### The site

The app has exactly two states and says which one it is in on every screen.
With no `NEXT_PUBLIC_ENGINE_ADDRESS` it is the read-only preview: generated
marks, a ticket that prices correctly and refuses to submit. With one, every
screen reads the engine — marks, funding, open interest, balances, positions —
and the ticket, the deposit field and the withdraw button all work.

**All reading goes through `/api/*`, never from the browser.** `/api/markets`
is one `marketsView` call for all 64 pairs, `/api/account` one `positionsView`
plus two balances. That keeps the RPC off the public origin, works against
nodes that refuse cross-origin requests, and means one server-side call
instead of one per open tab. Only signing goes through the wallet.

Four screens: the board, a pair's terminal, the **pool** and the portfolio. The
pool screen is not optional — the engine is peer-to-pool, so until somebody
provides liquidity `openPosition` reverts on its first reservation and nothing
trades.

History and transfers are read from the contract's own events rather than a
database, because the events are the record and a second copy of it can
disagree. They need `NEXT_PUBLIC_DEPLOY_BLOCK` set, or a public node will
refuse the range and both tabs come back empty.

Deployed the same way as before:

```powershell
cd D:\dev\fxperps
npx vercel --prod
```

---

## Notes that have already cost somebody a day

- **`evm_version = "paris"`.** Robinhood Chain is an Arbitrum Orbit chain, and
  Orbit chains do not all carry the PUSH0 opcode. Bytecode containing it
  deploys fine and reverts on the first call. Paris emits none. Leave it until
  the chain is confirmed to support Shanghai.
- **Never `forge script` against mainnet with `USDG_ADDRESS` blank.** The
  fallback is a mock token with a public `mint`.
- **`node --env-file=.env dist/index.js`.** The keeper does not read a `.env`
  on its own; the shell will not have exported it either.
- **`.env` is never committed.** `.gitignore` covers it in both packages, and
  no key is ever printed to a log or pasted into a chat.
