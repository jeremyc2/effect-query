# effect-query

A vibe fork of [TanStack Query](https://github.com/TanStack/query), written in [Effect V4](https://github.com/Effect-TS/effect-smol), making heavy use of [Tim Smart](https://github.com/tim-smart)'s Effect Atom, which has since been folded into Effect V4 itself and expanded upon.

## Inspiration

- [Why You Want React Query](https://tkdodo.eu/blog/why-you-want-react-query)

## Core ideas

- `createQueryAtom(...)` creates a single query atom for one cache entry.
- `createQueryAtomFactory(...)` creates a parameterized query definition that
  returns query atoms for different arguments.
- `createMutationAtom(...)` creates a single mutation atom.
- `createMutationAtomFactory(...)` creates a parameterized mutation definition
  that returns mutation atoms for different arguments.
- `makeRuntime(...)` creates the shared runtime that owns cache behavior and can
  carry Effect layers and services.
- Query functions return `Effect`s, not Promises.
- Query functions receive a context object with `queryKey` and `signal`.
- Query and mutation results expose status flags and data directly on the value
  you read from the atom, for example `result.isPending`,
  `result.isSuccess`, `result.isError`, `result.data`, and `result.error`.

## Small example

```ts
import { createQueryAtomFactory, makeRuntime } from "effect-query";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";

const runtime = makeRuntime();

const userQuery = createQueryAtomFactory({
	runtime,
	queryKey: (userId: string) => ["user", userId],
	staleTime: "1 minute",
	gcTime: "5 minutes",
	queryFn: (userId, { queryKey, signal }) =>
		Random.nextUUID,
});
```

## Supported query concepts

The current API surface includes:

- `queryKey`
- `queryFn`
- `staleTime`
- `gcTime`
- `refetchInterval`
- `enabled`
- `initialData`
- `initialDataUpdatedAt`
- `placeholderData`
- `networkMode`
- `retry`
- `refetchOnMount`
- `refetchOnWindowFocus`
- `refetchOnReconnect`

Queries and query atom factories also expose imperative helpers:

- `prefetch`
- `ensure`
- `peek`
- `refresh`
- `cancel`
- `setData`

Mutations use `createMutationAtom(...)`, `createMutationAtomFactory(...)`, and
`mutationFn`, with built-in support for invalidation and `onSuccess`.

## Docs

- [TanStack concept coverage](./docs/tanstack-concepts-support.md)
- [Effect-first TanStack concepts](./docs/effect-first-tanstack-concepts.md)
- [Reactive topology notes](./docs/reactive-topology.md)
- [Tutorial for TanStack Query developers](./docs/tutorials/effect-query-for-tanstack-query-developers.html)
- [Tutorial for Effect Atom developers](./docs/tutorials/effect-query-for-effect-atom-developers.html)

## Example

- [React Bun example](./examples/react-bun)

## Development

Install dependencies:

```bash
bun install
```

Run the full project checks:

```bash
bun all
```
