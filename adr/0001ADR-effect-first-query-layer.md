# 1. Adopt an Effect-first query layer

## Status

Accepted

## Context and Problem Statement

We want to build a package that solves the same class of server-state problems that made TanStack Query valuable, but without adopting TanStack Query's public interfaces or Promise-first architecture.

The package should feel native to Effect from the outside in. That means:

- the outermost layer should be Effect-first, not Promise-based
- the primary consumption model should be atom-first, in tandem with Effect Atom
- reactivity keys should drive invalidation and refresh
- React apps should need far less request-driving `useEffect`

We also want to keep the README lightweight and let external inspiration stay external rather than summarizing it inside project docs.

## Considered Options

### 1. Recreate TanStack Query's public interfaces

Keep the familiar `QueryClient`, observer, and hook-driven mental model while reimplementing the internals in Effect.

### 2. Build a thin React adapter over Effect internals

Use Effect under the hood, but present a conventional Promise-oriented JavaScript API at the outermost layer.

### 3. Build an Effect-first, atom-first query layer

Use Effect services, atoms, reactivity keys, and hydration primitives as the primary design vocabulary, while still targeting the same core server-state problems.

## Decision Outcome

Chosen option: **Build an Effect-first, atom-first query layer**.

The package will:

- keep `query`, `mutation`, `invalidate`, `hydrate`, and `dehydrate` as public terms
- avoid `QueryClient`, observer classes, and `useQuery`-style public interfaces
- use query families and query atoms as the primary read model
- use Effect Atom plus Effect reactivity as the primary React integration story
- use reactivity keys as the default invalidation model
- treat TanStack Query as inspiration for the problem space, not for the API shape
- keep the README minimal, with only a small inspiration link to TkDodo's post

## Consequences

### Positive

- The package stays aligned with Effect practices all the way to the public surface.
- React consumers can compose server state through atoms and Effects instead of request-driven `useEffect`.
- Invalidation, hydration, and mutation flows align with Effect reactivity rather than a parallel cache-client abstraction.
- The docs separate project decisions from external reading: the ADR captures the why, and the README stays light.

### Negative

- The library will feel less immediately familiar to existing TanStack Query users.
- We need to define and maintain our own vocabulary instead of borrowing TanStack Query's full conceptual model.
- Runtime-sharing and cache admin APIs require more care because we are not leaning on a single global client object.

### Neutral

- We still inherit many of the same domain problems as TanStack Query: cache identity, stale data, retries, invalidation, hydration, and mutation coordination.
