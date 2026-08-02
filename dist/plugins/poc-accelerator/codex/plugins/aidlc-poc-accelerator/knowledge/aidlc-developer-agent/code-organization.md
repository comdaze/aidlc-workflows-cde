# PoC Code Organization

Three principles matter more than any specific convention: modularity through
file names, small files and small units, and indirection between layers. A PoC
earns nothing from big-design ceremony, but it earns a lot from code the
customer's engineers can read in one sitting and extend without a rewrite.

## 1. Modularity through file names

A file name is a contract about scope. A file called `utils.py`, `helpers.py`,
or `common.js` is an invitation to dump anything in there, and people will.
Use action-oriented names that force small scope:

- `usd_to_eur_price_converter.py` — converts between USD and EUR formats
- `eval_report_generator.py` — builds the report for one specific evaluation
- `auth_token_validator.py` — validates auth tokens

The name is a forcing function: if you cannot describe what belongs in the
file in one sentence, the name is too broad. When a function does not fit the
file's name, it belongs somewhere else. Do not create a `utils` file in a PoC;
every function gets a home that describes its purpose.

## 2. Small files, small units

No file should take minutes of scrolling to read. Break code into functions,
methods, and classes that each do one thing. If a file crosses roughly 500
lines it is probably doing two jobs and should be split. This is a signal, not
a hard rule — some files are legitimately long — but bloat means
responsibilities are not separated, and in a 3–5-day PoC nobody has time to
untangle them at handoff.

## 3. Indirection (shims) between layers

When code needs data from a store or an external system, put a thin layer in
between instead of scattering calls everywhere. A `user_client.get_user(id)`
that returns a domain object hides whether the backing store is Postgres,
DynamoDB, or a flat file; when the store changes, one module changes, not
fifty call sites.

This is the PoC-to-production lever: the extension recommendations can say
"swap the adapter" precisely because the seams exist. The walking skeleton
should already show these seams on its one vertical slice. When in doubt, add
a layer — removing an unnecessary abstraction later is cheaper than untangling
direct coupling across a codebase.

## A recommended layout

Not the only valid layout — the point is that each folder has one
responsibility, and code that talks to different systems (API, database,
external services) is physically separated so a change in one does not ripple
into the others:

```
project/
├── src/
│   ├── api/          # route handlers: parse request -> call service
│   ├── service/      # orchestration: validate -> fetch -> transform
│   ├── client/       # domain-facing access: get_user(id) -> User
│   ├── db/           # adapter: connections, queries for one store
│   └── model/        # domain objects (dataclasses/types)
├── tests/
│   ├── unit/
│   └── integration/
├── infra/            # TypeScript CDK app (stacks, constructs)
└── scripts/          # bounded operational helpers, each named for its job
```

Each request flows through one layer at a time (api → service → client →
adapter). Swapping the store means writing a new adapter and updating the
client; handlers, service logic, and the tests written against the client
interface stay untouched.

## PoC-specific guidance

- The walking skeleton (step 4) establishes the layout; feature expansion
  (step 5) fills it in. Do not defer structure to "after the PoC" — the
  deliverable is code the customer extends, and the layer seams are what the
  extension recommendations point at.
- Keep the redaction/masking boundary (data posture rule) in its own module on
  the data path, so the GenAIIC-approved handling is one visible seam, not
  logic sprinkled through handlers.
- Right-size the ceremony: a one-slice PoC may collapse service and client
  into one thin module — but never inline store access in route handlers, and
  never create a `utils` dumping ground.
