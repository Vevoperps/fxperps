# <img width="2172" height="724" alt="image" src="https://github.com/user-attachments/assets/f7a29598-1869-4168-8525-41ceb747a0ab" />

# vevo

Perpetual futures on the world's currencies against the dollar. Open 24/7, one
balance, settled onchain.

[vevoperps.com](https://vevoperps.com)

---

## What is in here

One repository, three deployables, one source of truth for the numbers.

```
src/            The site and the app. Next.js 16, React 19, Tailwind 4.
  app/            Routes. They delegate to views and hold no logic.
  views/          The screens: landing, docs, and the app terminal.
  lib/chain/      Everything that talks to the engine.
  data/           Every word the product says, in three files.
backend/
  contracts/      Foundry. The engine, the oracle adapter, the tests.
  keeper/         Node 22 + TypeScript. Posts prices, liquidates.
  shared/         Generated: the market table and the ABIs.
  tools/          The generators that write shared/.
obsidian/       The project's own documentation vault.
```

The market table is written once, in `src/lib/markets.ts`, and generated from
there into Solidity and JSON. Nothing re-types those 64 rows by hand, and CI
fails if the generated copies are stale — because the failure that matters is
the silent one, where the app and the chain disagree about what a pair is
allowed to do.

## How the venue works

**The venue is the counterparty.** There is no order book. A trade fills at the
oracle's mark and the other side of it is a pool of settlement tokens that
liquidity providers own. That is what makes a frontier currency tradeable at
three in the morning, and it is what the payout cap is for: every open position
has the most it can ever return reserved out of that pool, so the number on the
ticket is backed rather than promised.

**Custody stays with the trader.** No function lets the owner touch a balance,
no pause traps a withdrawal, and closing a position works on a paused market.
Listing markets and setting their parameters is the whole of what the admin key
can do.

**Maintenance is permissionless.** Anyone can call `poke` and `liquidate`, and
a liquidator is paid out of what is left of the position. The keeper in this
repository is a convenience, not a dependency.

The arithmetic — the fee, the funding cap, the maintenance floor, the payout
cap — is defined once in `backend/contracts/src/libraries/PositionMath.sol`,
printed by the site, stated in the handbook, and asserted in
`backend/contracts/test/PerpEngine.t.sol`. If any of the four ever disagree,
the test suite fails before a user finds out.

`backend/README.md` has the full walk-through.

## Running it

```sh
yarn install
yarn dev            # http://localhost:3000
```

That gives you the **preview**: the marks are generated, the ticket prices
correctly and refuses to submit, and every screen says so. Nothing else is
needed to work on the site.

For the real thing on your own machine — a local chain with all 64 markets,
a faucet, and the whole path from deposit to withdrawal — see
[backend/README.md](backend/README.md). It needs Foundry and two commands.

### Environment

Copy `.env.example` to `.env.local` and fill in what you need. Every variable
is documented there. Two worth knowing:

- `SITE_PASSWORD` — the pre-launch gate. **There is no default.** Unset means
  the gate is off, which is what a clone wants; production sets it in Vercel.
- `NEXT_PUBLIC_ENGINE_ADDRESS` — set it and the app stops previewing and starts
  reading the contract.

## Deploying

| | |
|---|---|
| Site | Vercel, from the repository root. `npx vercel --prod` |
| Contracts | Foundry, `backend/contracts/script/Deploy.s.sol` |
| Keeper | Railway, root directory `backend`, Dockerfile `keeper/Dockerfile` |

`.vercelignore` keeps `backend/` and `obsidian/` out of the site build.

## Status

Pre-launch. The contracts are **not audited**. The app runs against a local
chain today; the testnet and mainnet deployments wait on the settlement token
address, an RPC endpoint and the oracle's own address on the target chain.

## License

See [LICENSE.md](LICENSE.md). The repository is readable so the arithmetic can
be checked; it is not a grant to redeploy it. The contract sources under
`backend/contracts/src/` are MIT, as their headers say.
