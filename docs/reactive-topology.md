# Reactive Topology

This library should avoid the "one broad reactive surface" pitfall described in
TanStack's signal-graph refactor notes.

## Source Of Truth

The internal source of truth is **per-query-entry state**, not a single shared
reactive snapshot for the whole runtime.

- Each query cache entry owns its own `SubscriptionRef<QueryResult<...>>`.
- A query atom subscribes directly to the matching entry's `SubscriptionRef`.
- Unrelated query atoms should not be notified when a different query entry
  changes.

The runtime-level `QueryStore` still keeps global bookkeeping:

- entry lookup
- invalidation scans
- focus/reconnect refetch scans
- garbage collection scans

Those global structures are orchestration state, not the main reactive surface
that UI subscribers read from.

## Guardrail

`src/EffectQuery.test.ts` includes a regression test that verifies refreshing one
query atom does not notify an unrelated query atom subscriber.

If we ever add aggregate features like global fetching indicators, filters, or
devtools state, we should preserve this topology:

- small stores are the primary reactive surface
- broad snapshots are derived views, not the internal source of truth
- consumers should subscribe to the narrowest store that matches their concern
