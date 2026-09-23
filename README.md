<h1>vevo</h1>

Perpetual futures on 64 world currencies, settled onchain.

[Website](https://vevoperps.com) · [Docs](https://vevoperps.com/docs) · [Trading guide](https://vevoperps.com/docs/trading)

## Why vevo

- **Currencies nobody else lists.** The majors, and the naira, the dong, the tenge, the guarani. 64 pairs across 75 countries, every one quoted against the US dollar.
- **One balance, every market.** Deposit once in USDG. The same balance margins a position on any pair.
- **Up to 25x, with the numbers up front.** Size, fee, liquidation price and the most a position can ever pay are all shown before the signature, and all four come from the contract.
- **No order book and no queue.** Fills happen at the venue's mark against a pool, so there is no counterparty to wait for.
- **Self custodial.** No account, no deposit address, no withdrawal approval. Positions and balances live in the contract and only the holder's key moves them.

## How it works

The engine is peer to pool. The pool is the counterparty to every trade, and each open position has its payout cap reserved out of the pool before it opens, so what a trader is promised is set aside rather than hoped for.

```
notional     = margin x leverage
fee          = 0.05% of notional, each way
liquidation  = entry x (1 - (1 / leverage - 0.005))
max payout   = 10 x margin, fixed when the position opens
```

Prices reach the chain through a keeper that reads conventional FX rates and posts them to a `PushOracle`, where it is the named publisher. Marks on that oracle are posted rather than signed, and the deployment says so in its own logs. Pyth was the original design and is not usable here: its public endpoint closed in August 2026, the free tier excludes FX, and it never carried the frontier currencies this venue lists.

Funding is charged against the skew between long and short interest, capped at 0.75%. Liquidation is permissionless: anyone may call it on a position below its maintenance margin.

## Deployments

Robinhood Chain, chain id `4663`.

| Contract | Address |
| --- | --- |
| PerpEngine | [`0x26fdBD849ed358cffa153A10cFF7b4fA41596b7A`](https://robinhoodchain.blockscout.com/address/0x26fdBD849ed358cffa153A10cFF7b4fA41596b7A) |
| PushOracle | [`0x27331183F3293A6a782D2dc0F692A1a0314bDd43`](https://robinhoodchain.blockscout.com/address/0x27331183F3293A6a782D2dc0F692A1a0314bDd43) |
| USDG | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |

USDG is Robinhood Chain's native dollar stablecoin, six decimals, issued by Paxos. It is not ours.

## Layout

```
src/            the site and the trading app (Next.js, TypeScript)
backend/
  contracts/    the engine, the oracle and the deploy scripts (Foundry)
  keeper/       posts marks, liquidates, takes the daily snapshot (Node)
```

## Build from source

```bash
yarn install
yarn dev
```

Before opening a pull request:

```bash
npx tsc --noEmit
npx eslint src/
yarn build
```

The app reads the chain entirely from the environment, so pointing it at another deployment needs no code change. Contract addresses are public the moment they exist, which is why they carry the `NEXT_PUBLIC_` prefix. The app holds no key and signs nothing.

```
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
NEXT_PUBLIC_ENGINE_ADDRESS=0x26fdBD849ed358cffa153A10cFF7b4fA41596b7A
NEXT_PUBLIC_SETTLEMENT_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_DEPLOY_BLOCK=69562726
```

With no engine address configured the app renders as a read only preview and says so on every screen, rather than showing live buttons over a venue that is not there.

## Contracts

Foundry, Solidity 0.8.24, `evm_version = "paris"`. That setting is load bearing: Robinhood Chain is an Arbitrum Orbit rollup, Orbit chains do not all carry the PUSH0 opcode, and bytecode containing it deploys cleanly and reverts on the first call.

```bash
cd backend/contracts
forge build
forge test
```

Deploying a venue of your own, in order. Every step wants `--slow` on this chain.

```bash
forge script script/Deploy.s.sol:Deploy                     --rpc-url $RPC_URL --broadcast --slow
forge script script/ListMarkets.s.sol:ListMarkets           --rpc-url $RPC_URL --broadcast --slow
forge script script/SetPushOracle.s.sol:SetPushOracle       --rpc-url $RPC_URL --broadcast --slow
forge script script/ProvideLiquidity.s.sol:ProvideLiquidity --rpc-url $RPC_URL --broadcast --slow
```

`ListMarkets` is the resume path. It reads which markets the engine already holds, diffs that against the table and sends only the difference, so it is safe to run twice and converges. `forge script --resume` is not: it replays the saved broadcast with the nonces it recorded, and one desync makes every retry fail having sent nothing.

`ProvideLiquidity` spends real tokens from the caller's balance and mints nothing. Its testnet counterpart `SeedLiquidity` mints, and refuses to run on chain 4663.

### Gas on Orbit chains

`eth_gasPrice` answers below the chain's own `baseFeePerGas`, so anything that trusts it builds a transaction the same node rejects with `max fee per gas less than block base fee`. `cast send` needs `--gas-price 1gwei`, and the app quotes the fee off the block header instead. Under EIP-1559 the surplus is refunded, so bidding high costs nothing.

## Keeper

```bash
cd backend/keeper
yarn install
yarn build
node --env-file=.env dist/index.js
```

Copy `.env.example` and fill it in. The key it signs with can post marks and liquidate; neither can move anyone's balance, so it wants a wallet holding gas and nothing else.

Two settings are load bearing. `MIN_MOVE_BPS` skips a pair that has not moved, because rewriting all 64 marks every round costs a fraction of an ether a day. Snapshots go out in batches of eight with the nonce re-read before each batch: one parallel burst collides with itself, and one at a time outruns the oracle's staleness window.

## Security

These contracts have not been audited. The venue is young and its pool is small, and both facts are visible onchain rather than described here.

Two properties are worth knowing before depositing. The oracle's marks are posted by a named publisher rather than signed by a third party, so that publisher decides the price a position fills and liquidates at. And every position's payout is capped at ten times its margin, fixed at the moment it opens, which is what bounds the pool's loss and is reserved up front.

Found something? Open an issue, or reach us through the site.

## License

All rights reserved. See [LICENSE.md](LICENSE.md).
