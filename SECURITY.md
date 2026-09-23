# Security

## Status

The contracts in this repository have not been audited.

They are deployed and holding real funds on Robinhood Chain. Anyone reading
this should weigh that plainly: the code is young, the pool is small, and no
third party has reviewed it.

## Reporting a vulnerability

Do not open a public issue for anything that could be used to take funds.

Report it through the contact form at
[vevoperps.com](https://vevoperps.com), or by direct message on X. Include
enough to reproduce it: the contract, the call sequence, and what an attacker
ends up holding.

You will get an answer. If the report is real, the affected markets are paused
while it is fixed, and you are credited unless you ask not to be.

## What the design already bounds

Not every risk is a bug, and two of these are deliberate trade-offs worth
stating rather than burying.

**The oracle is published, not signed.** A named publisher posts the marks that
positions open, close and liquidate at. Pyth was the original design; its FX
feeds are now gated behind a paid tier and it never carried the frontier
currencies this venue lists. The publisher is bounded by a staleness window and
a per-post deviation cap, both set at deployment and readable onchain, but it
is a trusted role and should be read as one.

**The payout is capped.** Every position can return at most ten times its
margin, fixed when it opens, and that amount is reserved out of the pool before
the position exists. This is what makes a small pool solvent rather than
hopeful: the venue's loss on any single position is known in advance and set
aside, so no run of winning trades can take more than was reserved for it.

**Liquidation is permissionless.** Anyone may liquidate a position below its
maintenance margin and collect the reward. The venue does not depend on its own
keeper being honest, only on somebody being awake.

## Keys

The engine has an owner, used to list and configure markets and to set the
oracle. It cannot move a user's balance, close a user's position, or withdraw
from the pool. Withdrawal rights stay with the holder of the funds at all
times.
