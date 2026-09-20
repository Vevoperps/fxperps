# License

Copyright (c) 2026 vevo. All rights reserved.

The source in this repository is published so that anyone can read it, check
the arithmetic and verify what the deployed contracts do. Publishing it is not
a grant of rights to reuse it.

**You may** read, audit, quote and discuss this code; interact with the
deployed contracts; and open issues or pull requests against this repository.

**You may not**, without written permission, copy, modify, redistribute or
deploy this software or any substantial part of it — including the site, its
copy, its design and the engine — whether or not the result is rebranded.

## The one exception

Files under `backend/contracts/src/` carry an `SPDX-License-Identifier: MIT`
header, and that header governs them. Contract source is read, verified and
forked by everyone on a block explorer; pretending otherwise would be
theatre, and the interfaces and the maths are not what makes this venue worth
using.

## Third-party code

`backend/contracts/lib/forge-std` is Foundry's standard library, vendored so a
fresh clone can run the test suite without a submodule step. It is MIT, and it
is not ours. Dependencies installed from npm keep their own licenses.

## No warranty

This software is provided "as is", without warranty of any kind, express or
implied. The contracts have not been audited. Nothing here is financial advice
and nothing here is an offer.
