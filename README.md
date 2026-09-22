# vevo

Perpetual futures on 64 world currencies against the US dollar, settled onchain
in USDG. One balance, up to 25x, no order book: every fill happens at the
venue's own mark.

Live at [vevoperps.com](https://vevoperps.com).

## What this repository is

Four pieces that ship together.

| Piece | Path | What it does |
| --- | --- | --- |
| Landing and docs | `src/app`, `src/views/home` | The public site and the handbook |
| Trading app | `src/views/app` | Terminal, portfolio, pool, token |
| Contracts | `backend/contracts` | The engine, the oracle, the deploy scripts |
| Keeper | `backend/keeper` | Posts marks, liquidates, takes daily snapshots |

## How the venue works

The engine is peer to pool. There is no counterparty on the other side of a
trade; the pool is, and every open position has its payout cap reserved out of
that pool before it opens. So an empty pool is a venue where nothing trades,
and pool size is the ceiling on open interest.

```
notional     = margin x leverage
fee          = 0.05% of notional, each way
liquidation  = entry x (1 - (1 / leverage - 0.005))
max payout   = 10 x margin, fixed when the position opens
```

Prices reach the chain through a keeper that fetches conventional FX rates and
posts them to a `PushOracle`, where it is the named publisher. Marks on that
oracle are posted, not signed. Pyth was the original plan and is not usable
here: its public endpoint closed in August 2026, the free key excludes FX, and
it never carried the frontier currencies this venue lists.

## Live deployment

Robinhood Chain mainnet, chain id `4663`.

| Contract | Address |
| --- | --- |
| PerpEngine | `0x26fdBD849ed358cffa153A10cFF7b4fA41596b7A` |
| PushOracle | `0x27331183F3293A6a782D2dc0F692A1a0314bDd43` |
| USDG (settlement) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

USDG is Robinhood Chain's native stablecoin, six decimals, issued by Paxos.
It is not ours and not a mock.

## Running the site

```bash
yarn install
yarn dev
```

Then `yarn build` before opening a pull request. The checks that matter:

```bash
npx tsc --noEmit
npx eslint src/
yarn build
```

### Environment

The app reads everything about the chain from the environment, so pointing it
at a different deployment needs no code change. Contract addresses are public
the moment they exist, which is why they carry the `NEXT_PUBLIC_` prefix;
nothing secret is ever put here, and the app holds no key and signs nothing.

```
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_ENGINE_ADDRESS=0x26fdBD849ed358cffa153A10cFF7b4fA41596b7A
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_DEPLOY_BLOCK=69562726
```

With no engine address configured the app renders as a read only preview and
says so on every screen, rather than showing buttons over a venue that is not
there.

## Contracts

Foundry, Solidity 0.8.24, `evm_version = "paris"`. The paris setting is not
cosmetic: Robinhood Chain is an Arbitrum Orbit rollup, Orbit chains do not all
carry the PUSH0 opcode Shanghai introduced, and bytecode containing it deploys
cleanly and reverts on the first call.

```bash
cd backend/contracts
forge build
forge test
```

Deploy order. Every step wants `--slow` on this chain.

```bash
forge script script/Deploy.s.sol:Deploy          --rpc-url $RPC_URL --broadcast --slow
forge script script/ListMarkets.s.sol:ListMarkets --rpc-url $RPC_URL --broadcast --slow
forge script script/SetPushOracle.s.sol:SetPushOracle --rpc-url $RPC_URL --broadcast --slow
forge script script/ProvideLiquidity.s.sol:ProvideLiquidity --rpc-url $RPC_URL --broadcast --slow
```

`ListMarkets` is the resume path. It reads which markets the engine already
holds, diffs that against the table and sends only the difference, so it is
safe to run twice and converges on the same place. `forge script --resume` is
not: it replays the saved broadcast with the nonces it recorded, and one nonce
desync makes every retry fail having sent nothing.

`SetFeeds.s.sol` belongs to the Pyth path and is not part of this deployment.

`ProvideLiquidity` spends real tokens out of the caller's balance and mints
nothing. Its testnet counterpart `SeedLiquidity` mints, and refuses to run on
chain 4663.

### Gas on Orbit chains

`eth_gasPrice` answers below the chain's own `baseFeePerGas`. Anything that
trusts it builds a transaction the same node then rejects with `max fee per gas
less than block base fee`. So `cast send` needs `--gas-price 1gwei`, and the
app quotes the fee off the block header instead, at four times the base fee
plus a tip. EIP-1559 refunds the surplus, so bidding high costs nothing.

## Keeper

```bash
cd backend/keeper
yarn install
yarn build
node --env-file=.env dist/index.js
```

Deployed on Railway with root directory `backend` and `keeper/Dockerfile`.
Copy `.env.example` and fill it in. The key it signs with can post marks and
liquidate; neither can move anyone's balance, so it wants a wallet holding gas
and nothing else.

Two settings are load bearing. `MIN_MOVE_BPS` skips a pair that has not moved,
because rewriting all 64 marks every round costs a fraction of an ether a day.
Snapshots go out in batches of eight with the nonce re-read from the node
before each batch: sending them in one parallel burst collides with itself, and
sending them one at a time outruns the oracle's staleness window.

## Deploying

```bash
npx vercel --prod
```

## Conventions

The full rules live in `AGENTS.md` and the Obsidian vault under `obsidian/`,
which is the source of truth for how this project is built. The short version:
all motion is spring based, no hardcoded style values outside the token layer,
routes delegate to views, server components by default, and no `any`.

## Licence

No licence granted. All rights reserved.
