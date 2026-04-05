# TanStack Concept Coverage

This document tracks how `effect-query` maps to the major concepts commonly
documented for TanStack Query. It is intentionally honest: a concept can be
**Supported**, **Partial**, or **Not Yet**.

## Coverage

| Concept | Status | Notes |
| --- | --- | --- |
| Important Defaults | Supported | Shared defaults exist through the query runtime and default query policy. |
| Queries | Supported | `createQueryAtom` and `createQueryAtomFactory` cover remote reads. |
| Query Keys | Supported | `queryKey` is a first-class option and is hashed for cache identity. |
| Query Functions | Supported | `queryFn` is a first-class option and can depend on runtime services. |
| Query Options | Supported | `queryOptions(...)` is available as an identity helper. |
| Network Mode | Partial | `networkMode: "online"` pauses fetches while offline and resumes them on reconnect, and `networkMode: "always"` ignores connectivity. `offlineFirst` still behaves like `always` until retry-specific pause semantics grow. |
| Parallel Queries | Supported | Multiple query atoms can be read in parallel. |
| Dependent Queries | Supported | Compose atoms so one query atom depends on local atom state or another query result. |
| Background Fetching Indicators | Partial | `isFetching` and `isRefetching` distinguish in-flight work, but there is no dedicated `useIsFetching`-style aggregate helper yet. |
| Window Focus Refetching | Supported | `refetchOnWindowFocus` plus `onWindowFocus`. |
| Polling | Supported | `refetchInterval` polls active query atoms while mounted. |
| Disabling/Pausing Queries | Partial | `enabled` is supported for automatic fetch control, but there is not yet a richer pause / `skipToken` story. |
| Query Retries | Partial | Retry schedules are supported, but not the TanStack-style `retryDelay` / `retryOnMount` option surface. |
| Paginated Queries | Partial | Parameterized query atoms work well for page-based queries, but there is no dedicated helper like `keepPreviousData`. |
| Infinite Queries | Not Yet | No built-in infinite-query helper yet. |
| Initial Query Data | Supported | `initialData` and `initialDataUpdatedAt` seed shared cache entries. |
| Placeholder Query Data | Partial | `placeholderData` is supported as observer-only data during the initial fetch, but there is no dedicated `isPlaceholderData` flag or previous-query callback shape yet. |
| Mutations | Supported | `createMutationAtom(...)`, `createMutationAtomFactory(...)`, and `mutationOptions(...)` are available. |
| Query Invalidation | Supported | Invalidate through reactivity keys and cache invalidation helpers. |
| Invalidation from Mutations | Supported | `invalidate` on mutations is built in. |
| Updates from Mutation Responses | Supported | `onSuccess` and `setData` cover direct cache updates. |
| Optimistic Updates | Supported | `setData` before the mutation, then invalidate or roll back as needed. |
| Query Cancellation | Partial | `cancel(...)` interrupts in-flight query work and `queryFn` receives an `AbortSignal`, but there is not yet a richer automatic-cancellation policy surface. |
| Scroll Restoration | Not Yet | No dedicated scroll-restoration support yet. |
| Filters | Partial | Reactivity keys cover invalidation targeting, but they are not a full TanStack Query filter API. |
| Performance & Request Waterfalls | Partial | Query atoms reduce unnecessary rerenders, but there is no dedicated request-waterfall tooling yet. |
| Prefetching & Router Integration | Supported | `prefetch`, `ensure`, and the router example already cover this pattern. |
| Server Rendering & Hydration | Supported | `dehydrate` and `hydrate` are available. |
| Advanced Server Rendering | Partial | Hydration exists, but there is not yet a larger SSR framework guide or deeper helper set. |
| Caching | Supported | Shared cache entries live in the query runtime with `staleTime` and `gcTime`. |
| Render Optimizations | Partial | Atom-level subscriptions help, but there is no TanStack-style selector/notify API yet. |

## Notes

- `gcTime` is the user-facing cache retention term.
- `refetchInterval` currently polls while a query atom is active. There is not
  yet a `refetchIntervalInBackground` option.
- Query functions now receive a context object with `queryKey` and `signal`.
