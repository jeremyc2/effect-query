import type * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";
import type * as Fiber from "effect/Fiber";
import type * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import type * as Semaphore from "effect/Semaphore";
import type * as ServiceMap from "effect/ServiceMap";
import type * as SubscriptionRef from "effect/SubscriptionRef";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { QueryStore } from "./store.ts";

export type QueryHash = string;
export type QueryKey = ReadonlyArray<unknown>;
export type ReactivityKeySet =
	| ReadonlyArray<unknown>
	| Readonly<Record<string, ReadonlyArray<unknown>>>;
export type QueryResult<A, E> = AsyncResult.AsyncResult<A, E>;
export type QueryCodec<A, E> = Schema.Codec<
	QueryResult<A | never, E | never>,
	unknown
>;
export type QueryRuntime<R = never, E = never> = Atom.AtomRuntime<
	R | QueryStore,
	E
>;
export type DataUpdater<A> = A | ((current: Option.Option<A>) => A);

export interface QueryPolicy<E = never, R = never> {
	readonly staleTime?: Duration.Input | undefined;
	readonly gcTime?: Duration.Input | undefined;
	readonly idleTimeToLive?: Duration.Input | undefined;
	readonly retry?: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount?: boolean | undefined;
	readonly refetchOnWindowFocus?: boolean | undefined;
	readonly refetchOnReconnect?: boolean | undefined;
}

interface QueryAtomFactorySharedOptions<Arg, A, E = never, R = never> {
	readonly runtime?: QueryRuntime<R> | undefined;
	readonly staleTime?: Duration.Input | undefined;
	readonly gcTime?: Duration.Input | undefined;
	readonly idleTimeToLive?: Duration.Input | undefined;
	readonly retry?: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount?: boolean | undefined;
	readonly refetchOnWindowFocus?: boolean | undefined;
	readonly refetchOnReconnect?: boolean | undefined;
	readonly reactivityKeys?:
		| ((arg: Arg) => ReactivityKeySet | undefined)
		| undefined;
	readonly policy?: QueryPolicy<E, R> | undefined;
	readonly label?: string | ((arg: Arg) => string) | undefined;
	readonly schema?: QueryCodec<A, E> | undefined;
}

type QueryAtomFactoryKeyOptions<Arg> =
	| {
			readonly queryKey: (arg: Arg) => QueryKey;
			readonly key?: (arg: Arg) => QueryKey;
	  }
	| {
			readonly key: (arg: Arg) => QueryKey;
			readonly queryKey?: (arg: Arg) => QueryKey;
	  };

type QueryAtomFactoryFnOptions<Arg, A, E = never, R = never> =
	| {
			readonly queryFn: (arg: Arg) => Effect.Effect<A, E, R>;
			readonly query?: (arg: Arg) => Effect.Effect<A, E, R>;
	  }
	| {
			readonly query: (arg: Arg) => Effect.Effect<A, E, R>;
			readonly queryFn?: (arg: Arg) => Effect.Effect<A, E, R>;
	  };

export type QueryAtomFactoryOptions<
	Arg,
	A,
	E = never,
	R = never,
> = QueryAtomFactorySharedOptions<Arg, A, E, R> &
	QueryAtomFactoryKeyOptions<Arg> &
	QueryAtomFactoryFnOptions<Arg, A, E, R>;

export interface QueryAtomFactory<Arg, A, E = never> {
	(arg: Arg): Atom.Atom<QueryResult<A, E>>;
	readonly key: (arg: Arg) => QueryKey;
	readonly hash: (arg: Arg) => QueryHash;
	readonly prefetch: (arg: Arg) => Effect.Effect<void>;
	readonly ensure: (arg: Arg) => Effect.Effect<A, E>;
	readonly peek: (arg: Arg) => Effect.Effect<Option.Option<QueryResult<A, E>>>;
	readonly refresh: (arg: Arg) => Effect.Effect<A, E>;
	readonly setData: (arg: Arg, updater: DataUpdater<A>) => Effect.Effect<A>;
}

export interface QueryAtom<A, E = never> extends Atom.Atom<QueryResult<A, E>> {
	readonly key: () => QueryKey;
	readonly hash: () => QueryHash;
	readonly prefetch: () => Effect.Effect<void>;
	readonly ensure: () => Effect.Effect<A, E>;
	readonly peek: () => Effect.Effect<Option.Option<QueryResult<A, E>>>;
	readonly refresh: () => Effect.Effect<A, E>;
	readonly setData: (updater: DataUpdater<A>) => Effect.Effect<A>;
}

export type CreateQueryAtomOptions<A, E, R> = CreateQueryAtomInput<A, E, R>;
export type QueryOptions<
	Arg,
	A,
	E = never,
	R = never,
> = QueryAtomFactoryOptions<Arg, A, E, R>;

interface MutationSharedOptions<Arg, A, R = never> {
	readonly runtime?: QueryRuntime<R> | undefined;
	readonly mutationKey?: QueryKey | undefined;
	readonly invalidate?:
		| ((arg: Arg, result: A) => ReactivityKeySet | undefined)
		| undefined;
	readonly onSuccess?:
		| ((
				result: A,
				arg: Arg,
		  ) => Effect.Effect<void, never, QueryStore | Reactivity.Reactivity>)
		| undefined;
	readonly concurrent?: boolean | undefined;
	readonly initialValue?: A | undefined;
}

type MutationFnOptions<Arg, A, E = never, R = never> =
	| {
			readonly mutationFn: (arg: Arg) => Effect.Effect<A, E, R>;
			readonly run?: (arg: Arg) => Effect.Effect<A, E, R>;
	  }
	| {
			readonly run: (arg: Arg) => Effect.Effect<A, E, R>;
			readonly mutationFn?: (arg: Arg) => Effect.Effect<A, E, R>;
	  };

export type MutationOptions<
	Arg,
	A,
	E = never,
	R = never,
> = MutationSharedOptions<Arg, A, R> & MutationFnOptions<Arg, A, E, R>;

export type QueryAtomFactoryInput<Arg, A, E, R> =
	| QueryAtomFactoryOptions<Arg, A, E, never>
	| (QueryAtomFactoryOptions<Arg, A, E, R> & {
			readonly runtime: QueryRuntime<R>;
	  });

export type MutationInput<Arg, A, E, R> =
	| MutationOptions<Arg, A, E, never>
	| (MutationOptions<Arg, A, E, R> & {
			readonly runtime: QueryRuntime<R>;
	  });

type CreateQueryAtomSharedOptions<A, E, R> = Omit<
	QueryAtomFactorySharedOptions<void, A, E, R>,
	"runtime"
>;

type CreateQueryAtomKeyOptions =
	| {
			readonly queryKey: QueryKey;
			readonly key?: QueryKey;
	  }
	| {
			readonly key: QueryKey;
			readonly queryKey?: QueryKey;
	  };

type CreateQueryAtomFnOptions<A, E, R> =
	| {
			readonly queryFn: Effect.Effect<A, E, R>;
			readonly query?: Effect.Effect<A, E, R>;
	  }
	| {
			readonly query: Effect.Effect<A, E, R>;
			readonly queryFn?: Effect.Effect<A, E, R>;
	  };

export type CreateQueryAtomInput<A, E, R> =
	| (CreateQueryAtomSharedOptions<A, E, never> &
			CreateQueryAtomKeyOptions &
			CreateQueryAtomFnOptions<A, E, never> & {
				readonly runtime?: undefined;
			})
	| (CreateQueryAtomSharedOptions<A, E, R> &
			CreateQueryAtomKeyOptions &
			CreateQueryAtomFnOptions<A, E, R> & {
				readonly runtime: QueryRuntime<R>;
			});

export type CreateQueryAtomInputWithRuntime<A, E, R> = Extract<
	CreateQueryAtomInput<A, E, R>,
	{ readonly runtime: QueryRuntime<R> }
>;

export type ResolvedQueryPolicy<E, R> = {
	readonly staleTimeMs: number;
	readonly idleTimeToLiveMs: number;
	readonly retry: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount: boolean;
	readonly refetchOnWindowFocus: boolean;
	readonly refetchOnReconnect: boolean;
};

export type InternalQuery<Arg, A, E, R> = {
	readonly key: (arg: Arg) => QueryKey;
	readonly query: (arg: Arg) => Effect.Effect<A, E, R>;
	readonly reactivityKeys: (arg: Arg) => ReactivityKeySet | undefined;
	readonly policy: ResolvedQueryPolicy<E, R>;
	readonly schema: QueryCodec<A, E>;
	readonly label: (arg: Arg) => string;
	readonly entries: Map<QueryHash, QueryEntry<Arg, A, E, R>>;
};

export type QueryEntryBase = {
	readonly hash: QueryHash;
	readonly policy: Pick<
		ResolvedQueryPolicy<never, never>,
		| "staleTimeMs"
		| "idleTimeToLiveMs"
		| "refetchOnMount"
		| "refetchOnWindowFocus"
		| "refetchOnReconnect"
	>;
	readonly reactivityHashes: ReadonlySet<string>;
	readonly snapshot: () => QueryResult<unknown, unknown>;
	readonly triggerFetch: Effect.Effect<void>;
	readonly remove: () => void;
	activeCount: number;
	invalidated: boolean;
	lastInactiveAt: number | undefined;
	inFlight: Fiber.Fiber<unknown, unknown> | undefined;
};

export type QueryEntry<Arg, A, E, R> = QueryEntryBase & {
	readonly definition: InternalQuery<Arg, A, E, R>;
	readonly arg: Arg;
	readonly key: QueryKey;
	readonly runQuery: Effect.Effect<A, E>;
	readonly resultRef: SubscriptionRef.SubscriptionRef<QueryResult<A, E>>;
	readonly lock: Semaphore.Semaphore;
	readonly current: () => QueryResult<A, E>;
	readonly setResult: (result: QueryResult<A, E>) => Effect.Effect<void>;
	readonly triggerFetch: Effect.Effect<void>;
	inFlight: Fiber.Fiber<A, E> | undefined;
};

export type TouchReason = "ensure" | "mount" | "prefetch" | "refresh";
export type EventReason = "reconnect" | "window-focus";

export const QueryRuntimeLayerId = Symbol.for(
	"effect-query/EffectQuery/QueryRuntimeLayer",
);
export const QueryRuntimeStateId = Symbol.for(
	"effect-query/EffectQuery/QueryRuntimeState",
);

export type QueryRuntimeWithLayer<R = never, E = never> = QueryRuntime<R, E> & {
	readonly [QueryRuntimeLayerId]: Layer.Layer<R | QueryStore, E>;
	readonly [QueryRuntimeStateId]: {
		readonly scope: Scope.Closeable;
		readonly lock: Semaphore.Semaphore;
		services: Option.Option<ServiceMap.ServiceMap<R | QueryStore>>;
	};
};

export const defaultPolicy = Object.freeze({
	staleTime: "0 millis",
	gcTime: "5 minutes",
	idleTimeToLive: "5 minutes",
	refetchOnMount: true,
	refetchOnReconnect: true,
	refetchOnWindowFocus: true,
}) satisfies {
	readonly staleTime: Duration.Input;
	readonly gcTime: Duration.Input;
	readonly idleTimeToLive: Duration.Input;
	readonly refetchOnMount: boolean;
	readonly refetchOnReconnect: boolean;
	readonly refetchOnWindowFocus: boolean;
};
