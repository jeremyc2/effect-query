# Effect-First TanStack Concepts

`effect-query` owes a lot to TanStack Query. The shape of the problem is the
same: remote state is not the same thing as local UI state, and it deserves
first-class tools for caching, refetching, retries, invalidation, hydration,
and mutation workflows.

At the same time, `effect-query` is not trying to be "TanStack Query with
different imports". It starts from a different center of gravity:

- query state is read through **query atoms** and **query atom factories**
- asynchronous work is expressed as **Effect**, not `Promise`
- the cache runtime is still global orchestration, but the reactive surface is
  **per entry**, not one broad client snapshot
- local state and remote state both live naturally in the Effect Atom world

So the library ends up feeling more **Effect-native** than React-client-native,
even when it expands on ideas TanStack popularized.

This post walks through the major concepts from the TanStack Query docs and
explains how each one maps into `effect-query`.

## The Core Shift

TanStack Query usually starts from a client and a hook:

- `queryClient`
- `useQuery(...)`
- `useMutation(...)`

`effect-query` starts from a runtime and an atom:

- `makeRuntime(...)`
- `createQueryAtom(...)`
- `createQueryAtomFactory(...)`
- `createMutationAtom(...)`
- `createMutationAtomFactory(...)`

That sounds like a small syntax change, but it pushes the architecture in a
different direction.

In TanStack Query, components subscribe through observers hanging off a central
client. In `effect-query`, the thing your UI reads is already an atom. That
means remote state composition fits directly into the same reactive model as the
rest of an Effect Atom app.

## Important Defaults

TanStack Query is famous for having sharp defaults:

- cached data becomes stale by default
- stale queries refetch on mount, focus, and reconnect
- inactive data is retained for a while before garbage collection

`effect-query` keeps that general spirit.

- `staleTime` controls freshness
- `gcTime` controls cache retention
- refetch behavior is driven by `refetchOnMount`,
  `refetchOnWindowFocus`, and `refetchOnReconnect`

The main difference is where these defaults live. In TanStack Query they feel
like client policy. In `effect-query` they feel like **query runtime policy**
plus **per-entry atom behavior**.

## Queries

TanStack Query has one conceptual unit: a query observer around a query key.

`effect-query` splits this into two explicit terms:

- a **query atom** for one cache entry
- a **query atom factory** for parameterized queries

That distinction is deliberate. We want the reusable definition and the concrete
reactive value to be separate concepts.

```ts
const userQuery = createQueryAtomFactory({
	runtime,
	queryKey: (userId: string) => ["user", userId],
	queryFn: (userId) => fetchUser(userId),
});

const userAtom = userQuery("1");
```

TanStack Query can express the same thing, but `effect-query` makes the
reactive value itself first-class.

## Query Keys

This part is very close to TanStack Query.

- `queryKey` is the identity of cached data
- it is hashed for cache lookup
- parameterized query atom factories derive different entries from different
  keys

The Effect-first twist is that the query key is not only cache identity. It
also lives alongside **reactivity keys**, which handle invalidation targeting in
a way that feels closer to Effect Atom dependency systems than to TanStack's
filter object API.

## Query Functions

This is where the library starts feeling much more like Effect.

TanStack Query query functions return promises. `effect-query` query functions
return `Effect`.

```ts
const userQuery = createQueryAtomFactory({
	runtime,
	queryKey: (userId: string) => ["user", userId],
	queryFn: (userId, { queryKey, signal }) =>
		UserApi.use((api) => api.fetchUser(userId, { queryKey, signal })),
});
```

That buys us a few things:

- query work can depend on runtime services and layers naturally
- retries compose as `Effect.retry(...)`
- cancellation maps onto `AbortSignal` and fiber interruption
- request logic stays in the Effect world instead of crossing back and forth
  into promise wrappers

TanStack Query's function contract is simple and popular. `effect-query` pushes
further into the host ecosystem and says: if your app is already Effect-based,
your server-state layer should speak Effect natively too.

## Query Options

The public option names are intentionally close to TanStack Query now:

- `queryKey`
- `queryFn`
- `staleTime`
- `gcTime`
- `enabled`
- `refetchInterval`
- `initialData`
- `placeholderData`
- `networkMode`

That compatibility is useful because the concepts are good. But the semantics
still land in an Effect Atom environment:

- `queryOptions(...)` is just an identity helper
- a query option object feeds a query atom factory, not a React hook call
- query options shape the reactive object you read, not just a hook observer

## Network Mode

TanStack Query uses `networkMode` to control how aggressively queries interact
with connectivity state.

`effect-query` supports the same user-facing concept:

- `"online"`
- `"always"`
- `"offlineFirst"` is still partial

The implementation is different in flavor. Since query execution already lives
in the runtime/store layer, online/offline behavior becomes runtime
orchestration around query entry execution rather than hook-level policy.

## Parallel Queries

TanStack Query solves parallel queries by letting multiple queries exist side by
side in one render.

`effect-query` does the same thing, but the composition reads more like normal
reactive data composition:

- call `useAtomValue(...)` on multiple query atoms side by side
- or compose several query atoms into one derived atom and read that once
- each query atom still subscribes only to its own entry
- unrelated entries do not wake each other up

This is one of the nicest places where the Effect Atom foundation shows through.
Parallel remote state does not require a special array API to feel natural. It
is just multiple atoms being read together.

In React, the simplest version is just two reads:

```tsx
function Screen({ userId, projectId }: Props) {
  const user = useAtomValue(userQuery(userId));
  const project = useAtomValue(projectQuery(projectId));

  if (user.isPending || project.isPending) {
    return <Spinner />;
  }

  return (
    <>
      {user.data && <UserCard user={user.data} />}
      {project.data && <ProjectCard project={project.data} />}
    </>
  );
}
```

If you want a single `useAtomValue(...)`, compose the query atoms first:

```tsx
import * as Atom from "effect/unstable/reactivity/Atom";

function Screen({ userId, projectId }: Props) {
  const screenAtom = React.useMemo(
    () =>
      Atom.readable((get) => ({
        user: get(userQuery(userId)),
        project: get(projectQuery(projectId)),
      })),
    [userId, projectId],
  );

  const { user, project } = useAtomValue(screenAtom);

  if (user.isPending || project.isPending) {
    return <Spinner />;
  }

  return (
    <>
      {user.data && <UserCard user={user.data} />}
      {project.data && <ProjectCard project={project.data} />}
    </>
  );
}
```

That is the main difference from TanStack Query: `effect-query` does not need a
special `useQueries`-style primitive to make parallel remote state possible.
The atom layer is already the composition layer.

## Dependent Queries

TanStack Query often models dependent queries with `enabled`.

`effect-query` supports that same pattern directly:

```ts
const userQuery = createQueryAtomFactory({
  queryKey: (id: string) => ["user", id],
  queryFn: fetchUser,
});

const projectsQuery = createQueryAtomFactory({
  queryKey: (userId: string) => ["projects", userId],
  enabled: (userId: string | undefined) => userId !== undefined,
  queryFn: (userId) => fetchProjectsForUser(userId),
});
```

That covers the familiar "do not fetch until this value exists" case.

But the more Effect Atom-native pattern is to compose atoms directly when the
dependency is really part of your reactive model:

```tsx
import * as Atom from "effect/unstable/reactivity/Atom";

function Screen({ email }: Props) {
  const screenAtom = React.useMemo(
    () =>
      Atom.readable((get) => {
        const user = get(userByEmailQuery(email));

        if (user.data === undefined) {
          return { user, projects: undefined };
        }

        return {
          user,
          projects: get(projectsQuery(user.data.id)),
        };
      }),
    [email],
  );

  const { user, projects } = useAtomValue(screenAtom);

  if (user.isPending) {
    return <Spinner />;
  }
  if (user.isError) {
    return <ErrorView />;
  }
  if (projects?.isPending) {
    return <Spinner />;
  }

  return <ProjectsList projects={projects?.data ?? []} />;
}
```

That is the main difference from TanStack Query: dependent queries are not only
an option flag story. They can also just be reactive composition.

So the practical rule of thumb in `effect-query` is:

- use `enabled` when the query should stay defined but idle until an input is ready
- compose atoms when one piece of remote state genuinely determines whether or how another piece should be read

## Background Fetching Indicators

TanStack Query has rich status semantics like:

- `status`
- `fetchStatus`
- `isPending`
- `isFetching`
- `isRefetching`

We now mirror that style more closely, but with a cleaner result shape that does
not leak raw Effect `AsyncResult` fields.

So the query result you read from an atom exposes:

- `status`
- `fetchStatus`
- `isPending`
- `isSuccess`
- `isError`
- `isFetching`
- `isRefetching`
- `data`
- `error`
- `failureCause`
- `dataUpdatedAt`

The important Effect-first choice here is not the names. It is that this result
is the thing hanging off an atom, not a wrapper around a hook observer.

## Window Focus Refetching

Conceptually this matches TanStack Query closely.

- stale active queries can refetch on focus
- the behavior is configurable per query

The difference is how it is triggered. The runtime/store handles a focus event
and scans entries that need work. Query atoms then react to their own entry
updates.

That split keeps the global store as orchestration and the atom as the narrow
reactive surface.

## Polling

TanStack Query exposes polling through `refetchInterval`.

`effect-query` does too.

But the implementation is again more runtime-entry-oriented than observer-client
oriented:

- polling belongs to active query entries
- it is managed in the store
- the atom reflects the entry state

So the public idea is familiar, while the internal story stays closer to Effect
runtime coordination.

## Disabling And Pausing Queries

`enabled` works the way you would expect:

- automatic work stays idle when disabled
- manual refresh is still possible

What is different is that "disabled query" fits into a larger Effect Atom mental
model. Often you do not need a special skip mechanism because the surrounding
atoms already control whether a query atom is even being read.

## Query Retries

TanStack Query uses options like `retry` and `retryDelay`.

`effect-query` supports retries, but leans toward **Effect schedules** rather
than recreating the entire TanStack option API.

That is a very explicit example of "TanStack concept, Effect-native
implementation". The feature exists, but it composes with the Effect ecosystem
instead of hiding that ecosystem.

```ts
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const userQuery = createQueryAtomFactory({
  queryKey: (userId: string) => ["user", userId],
  retry: Schedule.recurs(3).pipe(
    Schedule.addDelay(() => "250 millis"),
  ),
  queryFn: (userId: string) =>
    HttpClient.get(`/api/users/${userId}`).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(User)),
    ),
});
```

The important difference from TanStack Query is that retries are not configured
through a small built-in DSL of numbers and callbacks. They are configured with
an Effect schedule, so the retry policy can stay in the same language as the
rest of your Effect program.

## Paginated Queries

TanStack Query has dedicated pagination guidance and helpers like
`keepPreviousData`.

`effect-query` currently approaches pagination through parameterized query atom
factories:

- page number lives in the query key
- each page is its own cache entry
- atoms give you natural per-page subscriptions

This works well, but it is still more primitive than TanStack's dedicated
pagination ergonomics. It is a good example of parity in core capability but
not yet in polish.

## Infinite Queries

This is still a gap.

TanStack Query has a dedicated infinite query model. `effect-query` does not
yet have its own first-class infinite query helper. Today you would build that
structure yourself from atoms and Effect, but the library does not yet package
that into a dedicated abstraction.

## Initial Data

This maps cleanly:

- `initialData`
- `initialDataUpdatedAt`

The main difference is again where the state lives. In `effect-query`, seeded
data becomes part of the shared query entry that query atoms subscribe to.

## Placeholder Query Data

Placeholder data is supported too, but with a slightly different tone than
TanStack Query.

- it is observer-facing, not cache-persisted
- it helps the initial read feel useful before the first real success lands

That is a place where the atom model helps because the query result being read
already feels like reactive UI data, not just a cache client snapshot.

## Mutations

TanStack Query has mutations. `effect-query` now has:

- `createMutationAtom(...)`
- `createMutationAtomFactory(...)`

This is the same overall idea, but brought into the atom vocabulary so remote
writes sit next to remote reads instead of feeling like a parallel API world.

Like queries, mutation atoms expose a library-owned result surface with
first-class fields like `status`, `isPending`, `isSuccess`, `isError`, `data`,
`error`, and `failureCause`.

That is intentionally more Effect-first than TanStack Query in one important
way: the public mutation state is ours, but the execution model underneath is
still powered by Effect and Effect Atom. We keep the underlying async state
machine as an implementation detail instead of leaking it into application
code.

## Query Invalidation

TanStack Query invalidation often works through query filters.

`effect-query` chooses **reactivity keys** instead.

This is one of the most distinctive design differences in the library. Instead
of treating invalidation mostly as a query-key filter language, we let query
definitions declare the reactivity surfaces they care about, and mutation or
manual invalidation targets those surfaces.

That feels much more Effect Atom-like:

- declare reactive relationships
- invalidate by relationship
- keep the broad client scan as orchestration, not as the primary user-facing
  model

```ts
const userQuery = createQueryAtomFactory({
  queryKey: (userId: string) => ["user", userId],
  reactivityKeys: (userId: string) => ({
    user: [userId],
    users: ["all"],
  }),
  queryFn: fetchUser,
});

const usersQuery = createQueryAtom({
  queryKey: ["users"],
  reactivityKeys: () => ({
    users: ["all"],
  }),
  queryFn: fetchUsers,
});

const updateUser = createMutationAtom({
  mutationFn: saveUser,
  invalidate: (input) => ({
    user: [input.userId],
    users: ["all"],
  }),
});
```

In that example:

- the single-user query declares that it depends on both `user:id` and the broader `users:all` relationship
- the list query declares that it depends on `users:all`
- the mutation invalidates those same relationships

So invalidation is not "find every query whose key matches this filter". It is
"refresh every query entry that declared itself part of this reactive
relationship."

## Invalidation From Mutations

This is built directly into mutation options:

```ts
const updateUser = createMutationAtom({
	runtime,
	mutationFn: saveUser,
	invalidate: (input) => ({
		users: ["all"],
		user: [input.userId],
	}),
});
```

TanStack Query often does this through `onSuccess` plus `queryClient`
imperative calls. `effect-query` supports imperative cache work too, but it also
lets invalidation stay declarative at the mutation definition level.

## Updates From Mutation Responses

This maps naturally onto `onSuccess` and `setData`.

The difference is the feel:

- TanStack Query says "update the client cache"
- `effect-query` says "update the matching query atom factory entry"

That is a small wording difference, but it reinforces the atom-native model.

## Optimistic Updates

Optimistic updates work well in `effect-query`:

- write optimistic data with `setData`
- run the mutation
- roll back or invalidate as needed

The nice part is that this composes directly with query atoms as reactive
values. You are not just patching a global cache object; you are updating the
entry that a specific query atom will expose to the UI.

## Query Cancellation

TanStack Query supports cancellation through abort-aware query functions.

`effect-query` does too, and this is another place where Effect helps:

- `queryFn` receives `signal`
- the runtime/store can cancel in-flight work
- interruption semantics compose naturally with Effect execution

So the surface concept is familiar, but the underlying machinery feels much more
native in an Effect codebase.

## Scroll Restoration

This is not built in yet.

TanStack Query has stronger documented patterns here because it lives so
comfortably in the React app/router world. `effect-query` does not yet have a
dedicated abstraction for this.

## Filters

TanStack Query has a broader filter model around queries and invalidation.

`effect-query` only partially overlaps here. The library is more opinionated:

- query keys identify entries
- reactivity keys identify invalidation groupings

That is narrower than TanStack's filter surface, but also simpler and more
aligned with the reactive-entry mental model.

## Performance And Request Waterfalls

TanStack Query has put a lot of thought into request waterfalls, observer
churn, and unnecessary updates.

`effect-query` takes that seriously too, but the strongest current story is its
reactive topology:

- per-entry `SubscriptionRef`
- narrow subscriptions
- no single giant reactive cache snapshot as the main UI surface

That is a very direct lesson learned from the broader TanStack ecosystem,
implemented in a way that fits Effect Atom well.

## Prefetching And Router Integration

This is already a strong fit.

- `prefetch`
- `ensure`
- `peek`
- `hydrate`
- `dehydrate`

TanStack Query usually routes these ideas through a client. `effect-query`
routes them through query atoms and query atom factories.

Again, same concept, more atom-native expression.

## Server Rendering And Hydration

This concept maps cleanly.

- `dehydrate(...)`
- `hydrate(...)`

Because the data ultimately lives in atom-compatible structures, hydration feels
like hydrating the reactive graph rather than rehydrating an external cache
client.

## Advanced Server Rendering

This is still only partially covered.

The basic hydration primitives exist, but the larger framework-specific story is
not as fully developed as TanStack Query's.

## Caching

Caching is one of the clearest shared ideas between the two libraries:

- `staleTime`
- `gcTime`
- shared entries
- explicit refresh and invalidation

But `effect-query` frames the cache as a runtime-backed store feeding query
atoms, not as the one main object the app talks to.

## Render Optimizations

TanStack Query has done a lot of work around observer notifications and render
behavior.

`effect-query` currently leans on the narrower subscription story that falls out
of Effect Atom:

- each query atom is tied to one entry
- unrelated query atoms do not have to rerender together
- the query runtime is not the main reactive surface

So this area is less feature-rich than TanStack Query today, but philosophically
very aligned with the same goal.

## Why This Feels More Effect-First

There are a few repeating themes in all of the sections above.

### The async model is Effect-native

TanStack Query is Promise-native. `effect-query` is Effect-native. That changes
retries, cancellation, service access, composition, and testing.

### The reactive model is atom-native

TanStack Query builds observers around a central client. `effect-query` exposes
query atoms directly.

That makes remote state feel like part of the app's real reactive graph instead
of a nearby subsystem.

### Invalidation is relationship-oriented

Reactivity keys are one of the most "ours" design choices in the library. They
do not try to fully imitate TanStack Query filters. They lean into a more
declarative dependency model.

### The store is orchestration, not the main read surface

This is subtle but important. `QueryStore` exists, and it absolutely matters,
but the UI should care mostly about specific query atoms and mutation atoms.

That is a different emphasis than "everything hangs off the client".

## Closing Thought

The best way to think about `effect-query` is probably:

> TanStack Query taught us which server-state concepts matter. Effect Atom and
> Effect change how natural those concepts can feel inside an Effect-first app.

So we happily borrow the concepts:

- staleness
- garbage collection
- invalidation
- hydration
- refetch triggers
- polling
- retries

But we want their final form in this library to feel like they belong to
Effect, not like a translated React client.
