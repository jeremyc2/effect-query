# TanStack Query Concept Coverage

This document tracks which TanStack Query concepts already map cleanly onto
`effect-query`, which ones are only partly there, and which ones are still
missing.

The point is not to claim parity. The point is to be honest about the current
surface area.

## Coverage snapshot

| Concept | Status | Notes |
| --- | --- | --- |
| Important defaults | Supported | Shared defaults live in the query runtime and default query policy. |
| Queries | Supported | `createQueryAtom(...)` and `createQueryAtomFactory(...)` cover remote reads. |
| Query keys | Supported | `queryKey` is first-class and hashed for cache identity. |
| Query functions | Supported | `queryFn` is first-class and can depend on runtime services. |
| Query options | Supported | `queryOptions(...)` is available as an identity helper. |
| Network mode | Partial | `networkMode: "online"` pauses fetches while offline and resumes them on reconnect, and `networkMode: "always"` ignores connectivity. `offlineFirst` still behaves like `always` until retry-aware pause semantics land. |
| Parallel queries | Supported | Multiple query atoms can be read side by side or composed into a larger atom. |
| Dependent queries | Supported | Compose atoms so one query atom depends on local atom state or another query result. |
| Background fetching indicators | Partial | `isFetching` and `isRefetching` are there, but there is no dedicated `useIsFetching`-style aggregate helper yet. |
| Window focus refetching | Supported | `refetchOnWindowFocus` plus `onWindowFocus`. |
| Polling | Supported | `refetchInterval` polls active query atoms while mounted. |
| Disabling and pausing queries | Partial | `enabled` is supported for automatic fetch control, but there is not yet a richer pause or `skipToken` story. |
| Query retries | Partial | Retry schedules are supported, but not the TanStack-style `retryDelay` / `retryOnMount` option surface. |
| Paginated queries | Partial | Query atom factories work well for page-based queries, but there is no dedicated helper like `keepPreviousData`. |
| Infinite queries | Not yet | No built-in infinite-query helper yet. |
| Initial query data | Supported | `initialData` and `initialDataUpdatedAt` seed shared cache entries. |
| Placeholder query data | Partial | `placeholderData` is supported during the initial fetch, but there is no dedicated `isPlaceholderData` flag or previous-query callback shape yet. |
| Mutations | Supported | `createMutationAtom(...)`, `createMutationAtomFactory(...)`, and `mutationOptions(...)` are available. |
| Query invalidation | Supported | Invalidate through reactivity keys and cache invalidation helpers. |
| Invalidation from mutations | Supported | `invalidate` on mutations is built in. |
| Updates from mutation responses | Supported | `onSuccess` and `setData` cover direct cache updates. |
| Optimistic updates | Supported | `setData` before the mutation, then invalidate or roll back as needed. |
| Query cancellation | Partial | `cancel(...)` interrupts in-flight work and `queryFn` receives an `AbortSignal`, but there is not yet a richer automatic-cancellation policy surface. |
| Scroll restoration | Not yet | No dedicated scroll-restoration support yet. |
| Filters | Partial | Reactivity keys cover invalidation targeting, but they are not a full TanStack Query filter API. |
| Performance and request waterfalls | Partial | Query atoms reduce unnecessary rerenders, but there is no dedicated waterfall analysis tooling yet. |
| Prefetching and router integration | Supported | `prefetch`, `ensure`, and the router example already cover this pattern. |
| Server rendering and hydration | Supported | `dehydrate(...)` and `hydrate(...)` are available. |
| Advanced server rendering | Partial | Hydration exists, but there is not yet a larger SSR guide or deeper helper set. |
| Caching | Supported | Shared cache entries live in the query runtime with `staleTime` and `gcTime`. |
| Render optimizations | Partial | Atom-level subscriptions help, but there is no TanStack-style selector/notify API yet. |

## Notes

- `gcTime` is the user-facing cache-retention term.
- `refetchInterval` currently polls while a query atom is active. There is not
  yet a `refetchIntervalInBackground` option.
- Query functions receive a context object with `queryKey` and `signal`.
