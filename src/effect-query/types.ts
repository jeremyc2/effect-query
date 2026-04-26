import type * as Cause from "effect/Cause";
import type * as Context from "effect/Context";
import type * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";
import type * as Fiber from "effect/Fiber";
import type * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schedule from "effect/Schedule";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import type * as Semaphore from "effect/Semaphore";
import type * as SubscriptionRef from "effect/SubscriptionRef";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { QueryStore } from "./store.ts";

export type QueryHash = string;
export type QueryKey = ReadonlyArray<unknown>;
export type QueryNetworkMode = "online" | "always" | "offlineFirst";
export type ReactivityKeySet =
	| ReadonlyArray<unknown>
	| Readonly<Record<string, ReadonlyArray<unknown>>>;
export type QueryEnabled<Arg> = boolean | ((arg: Arg) => boolean);
export type QueryInitialData<Arg, A> = A | ((arg: Arg) => A);
export type QueryInitialDataUpdatedAt<Arg> =
	| number
	| ((arg: Arg) => number | undefined);
export type QueryPlaceholderData<Arg, A> =
	| A
	| ((arg: Arg, previousValue: A | undefined) => A);
export interface QueryPending {
	readonly status: "pending";
	readonly fetchStatus: "fetching" | "idle";
	readonly isPending: true;
	readonly isSuccess: false;
	readonly isError: false;
	readonly isFetching: boolean;
	readonly isRefetching: false;
	readonly data: undefined;
	readonly error: undefined;
	readonly failureCause: undefined;
	readonly dataUpdatedAt: 0;
}

export interface QuerySuccess<A> {
	readonly status: "success";
	readonly fetchStatus: "fetching" | "idle";
	readonly isPending: false;
	readonly isSuccess: true;
	readonly isError: false;
	readonly isFetching: boolean;
	readonly isRefetching: boolean;
	readonly data: A;
	readonly error: undefined;
	readonly failureCause: undefined;
	readonly dataUpdatedAt: number;
}

export interface QueryFailure<A, E = never> {
	readonly status: "error";
	readonly fetchStatus: "fetching" | "idle";
	readonly isPending: false;
	readonly isSuccess: false;
	readonly isError: true;
	readonly isFetching: boolean;
	readonly isRefetching: boolean;
	readonly data: A | undefined;
	readonly error: E | undefined;
	readonly failureCause: Cause.Cause<E>;
	readonly dataUpdatedAt: number;
}

export type QueryResult<A, E> =
	| QueryPending
	| QuerySuccess<A>
	| QueryFailure<A, E>;
export type QueryCodec<A, E> = Schema.Codec<
	QueryResult<A | never, E | never>,
	unknown
>;
export type QueryRuntime<R = never, E = never> = Atom.AtomRuntime<
	R | QueryStore,
	E
>;
export type DataUpdater<A> = A | ((current: Option.Option<A>) => A);

export interface QueryFunctionContext {
	readonly queryKey: QueryKey;
	readonly signal: AbortSignal;
}

export interface QueryAtomFactoryOptions<Arg, A, E = never, R = never> {
	readonly runtime?: QueryRuntime<R> | undefined;
	readonly staleTime?: Duration.Input | undefined;
	readonly gcTime?: Duration.Input | undefined;
	readonly networkMode?: QueryNetworkMode | undefined;
	readonly refetchInterval?: Duration.Input | false | undefined;
	readonly enabled?: QueryEnabled<Arg> | undefined;
	readonly initialData?: QueryInitialData<Arg, A> | undefined;
	readonly initialDataUpdatedAt?: QueryInitialDataUpdatedAt<Arg> | undefined;
	readonly placeholderData?: QueryPlaceholderData<Arg, A> | undefined;
	readonly retry?: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount?: boolean | undefined;
	readonly refetchOnWindowFocus?: boolean | undefined;
	readonly refetchOnReconnect?: boolean | undefined;
	readonly reactivityKeys?:
		| ((arg: Arg) => ReactivityKeySet | undefined)
		| undefined;
	readonly queryKey: (arg: Arg) => QueryKey;
	readonly queryFn: (
		arg: Arg,
		context: QueryFunctionContext,
	) => Effect.Effect<A, E, R>;
	readonly label?: string | ((arg: Arg) => string) | undefined;
	readonly schema?: QueryCodec<A, E> | undefined;
}

export interface QueryAtomFactory<Arg, A, E = never> {
	(arg: Arg): Atom.Atom<QueryResult<A, E>>;
	readonly key: (arg: Arg) => QueryKey;
	readonly hash: (arg: Arg) => QueryHash;
	readonly prefetch: (arg: Arg) => Effect.Effect<void>;
	readonly ensure: (arg: Arg) => Effect.Effect<A, E>;
	readonly peek: (arg: Arg) => Effect.Effect<Option.Option<QueryResult<A, E>>>;
	readonly refresh: (arg: Arg) => Effect.Effect<A, E>;
	readonly cancel: (arg: Arg) => Effect.Effect<void>;
	readonly setData: (arg: Arg, updater: DataUpdater<A>) => Effect.Effect<A>;
}

export interface QueryAtom<A, E = never> extends Atom.Atom<QueryResult<A, E>> {
	readonly key: () => QueryKey;
	readonly hash: () => QueryHash;
	readonly prefetch: () => Effect.Effect<void>;
	readonly ensure: () => Effect.Effect<A, E>;
	readonly peek: () => Effect.Effect<Option.Option<QueryResult<A, E>>>;
	readonly refresh: () => Effect.Effect<A, E>;
	readonly cancel: () => Effect.Effect<void>;
	readonly setData: (updater: DataUpdater<A>) => Effect.Effect<A>;
}

export type CreateQueryAtomOptions<A, E, R> = CreateQueryAtomInput<A, E, R>;
export type QueryOptions<
	Arg,
	A,
	E = never,
	R = never,
> = QueryAtomFactoryOptions<Arg, A, E, R>;

export interface MutationIdle {
	readonly status: "idle";
	readonly isIdle: true;
	readonly isPending: false;
	readonly isSuccess: false;
	readonly isError: false;
	readonly data: undefined;
	readonly error: undefined;
	readonly failureCause: undefined;
}

export interface MutationPending<A> {
	readonly status: "pending";
	readonly isIdle: false;
	readonly isPending: true;
	readonly isSuccess: false;
	readonly isError: false;
	readonly data: A | undefined;
	readonly error: undefined;
	readonly failureCause: undefined;
}

export interface MutationSuccess<A> {
	readonly status: "success";
	readonly isIdle: false;
	readonly isPending: false;
	readonly isSuccess: true;
	readonly isError: false;
	readonly data: A;
	readonly error: undefined;
	readonly failureCause: undefined;
}

export interface MutationFailure<A, E = never> {
	readonly status: "error";
	readonly isIdle: false;
	readonly isPending: false;
	readonly isSuccess: false;
	readonly isError: true;
	readonly data: A | undefined;
	readonly error: E | undefined;
	readonly failureCause: Cause.Cause<E>;
}

export type MutationResult<A, E> =
	| MutationIdle
	| MutationPending<A>
	| MutationSuccess<A>
	| MutationFailure<A, E>;

export type MutationAtom<Arg, A, E = never> = Atom.Writable<
	MutationResult<A, E>,
	Arg | Atom.Reset | Atom.Interrupt
>;

export interface MutationAtomFactoryOptions<
	FactoryArg,
	Arg,
	A,
	E = never,
	R = never,
> {
	readonly runtime?: QueryRuntime<R> | undefined;
	readonly mutationKey?:
		| QueryKey
		| ((arg: FactoryArg) => QueryKey | undefined)
		| undefined;
	readonly invalidate?:
		| ((
				factoryArg: FactoryArg,
				arg: Arg,
				result: A,
		  ) => ReactivityKeySet | undefined)
		| undefined;
	readonly onSuccess?:
		| ((
				factoryArg: FactoryArg,
				result: A,
				arg: Arg,
		  ) => Effect.Effect<void, never, QueryStore | Reactivity.Reactivity>)
		| undefined;
	readonly concurrent?: boolean | undefined;
	readonly initialValue?: A | undefined;
	readonly mutationFn: (
		factoryArg: FactoryArg,
		arg: Arg,
	) => Effect.Effect<A, E, R>;
}

export type MutationAtomFactory<FactoryArg, Arg, A, E = never> = (
	arg: FactoryArg,
) => MutationAtom<Arg, A, E>;

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

export type MutationOptions<
	Arg,
	A,
	E = never,
	R = never,
> = MutationSharedOptions<Arg, A, R> & {
	readonly mutationFn: (arg: Arg) => Effect.Effect<A, E, R>;
};

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

type CreateMutationAtomFactorySharedOptions<FactoryArg, Arg, A, E, R> = Omit<
	MutationAtomFactoryOptions<FactoryArg, Arg, A, E, R>,
	"runtime" | "mutationFn"
>;

export type MutationAtomFactoryInput<FactoryArg, Arg, A, E, R> =
	| (CreateMutationAtomFactorySharedOptions<FactoryArg, Arg, A, E, never> & {
			readonly mutationFn: (
				factoryArg: FactoryArg,
				arg: Arg,
			) => Effect.Effect<A, E, never>;
			readonly runtime?: undefined;
	  })
	| (CreateMutationAtomFactorySharedOptions<FactoryArg, Arg, A, E, R> & {
			readonly mutationFn: (
				factoryArg: FactoryArg,
				arg: Arg,
			) => Effect.Effect<A, E, R>;
			readonly runtime: QueryRuntime<R>;
	  });

type CreateQueryAtomSharedOptions<A, E, R> = Omit<
	QueryAtomFactoryOptions<void, A, E, R>,
	"runtime" | "queryKey" | "queryFn"
>;

export type CreateQueryAtomInput<A, E, R> =
	| (CreateQueryAtomSharedOptions<A, E, never> & {
			readonly queryKey: QueryKey;
			readonly queryFn:
				| Effect.Effect<A, E, never>
				| ((context: QueryFunctionContext) => Effect.Effect<A, E, never>);
			readonly runtime?: undefined;
	  })
	| (CreateQueryAtomSharedOptions<A, E, R> & {
			readonly queryKey: QueryKey;
			readonly queryFn:
				| Effect.Effect<A, E, R>
				| ((context: QueryFunctionContext) => Effect.Effect<A, E, R>);
			readonly runtime: QueryRuntime<R>;
	  });

export type CreateQueryAtomInputWithRuntime<A, E, R> = Extract<
	CreateQueryAtomInput<A, E, R>,
	{ readonly runtime: QueryRuntime<R> }
>;

export type ResolvedQueryPolicy<E, R> = {
	readonly staleTimeMs: number;
	readonly gcTimeMs: number;
	readonly networkMode: QueryNetworkMode;
	readonly refetchIntervalMs: number | undefined;
	readonly retry: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount: boolean;
	readonly refetchOnWindowFocus: boolean;
	readonly refetchOnReconnect: boolean;
};

export type InternalQuery<Arg, A, E, R> = {
	readonly key: (arg: Arg) => QueryKey;
	readonly query: (
		arg: Arg,
		context: QueryFunctionContext,
	) => Effect.Effect<A, E, R>;
	readonly reactivityKeys: (arg: Arg) => ReactivityKeySet | undefined;
	readonly enabled: (arg: Arg) => boolean;
	readonly initialData: (arg: Arg) => A | undefined;
	readonly initialDataUpdatedAt: (arg: Arg) => number | undefined;
	readonly placeholderData: (
		arg: Arg,
		previousValue: A | undefined,
	) => A | undefined;
	readonly policy: ResolvedQueryPolicy<E, R>;
	readonly schema: QueryCodec<A, E> | undefined;
	readonly label: (arg: Arg) => string;
	readonly entries: Map<QueryHash, QueryEntry<Arg, A, E, R>>;
};

export type QueryEntryBase = {
	readonly hash: QueryHash;
	readonly policy: Pick<
		ResolvedQueryPolicy<never, never>,
		| "staleTimeMs"
		| "gcTimeMs"
		| "networkMode"
		| "refetchIntervalMs"
		| "refetchOnMount"
		| "refetchOnWindowFocus"
		| "refetchOnReconnect"
	>;
	readonly reactivityHashes: ReadonlySet<string>;
	readonly isEnabled: () => boolean;
	readonly snapshot: () => QueryResult<unknown, unknown>;
	readonly triggerFetch: Effect.Effect<void>;
	readonly remove: () => void;
	activeCount: number;
	invalidated: boolean;
	lastInactiveAt: number | undefined;
	inFlight: Fiber.Fiber<unknown, unknown> | undefined;
	poller: Fiber.Fiber<void, never> | undefined;
	abortController: AbortController | undefined;
	paused: boolean;
};

export type QueryEntry<Arg, A, E, R> = QueryEntryBase & {
	readonly definition: InternalQuery<Arg, A, E, R>;
	readonly arg: Arg;
	readonly key: QueryKey;
	readonly runQuery: (abortController: AbortController) => Effect.Effect<A, E>;
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
		services: Option.Option<Context.Context<R | QueryStore>>;
	};
};

export const defaultPolicy = Object.freeze({
	staleTime: "0 millis",
	gcTime: "5 minutes",
	networkMode: "online",
	refetchInterval: false,
	refetchOnMount: true,
	refetchOnReconnect: true,
	refetchOnWindowFocus: true,
}) satisfies {
	readonly staleTime: Duration.Input;
	readonly gcTime: Duration.Input;
	readonly networkMode: QueryNetworkMode;
	readonly refetchInterval: Duration.Input | false;
	readonly refetchOnMount: boolean;
	readonly refetchOnReconnect: boolean;
	readonly refetchOnWindowFocus: boolean;
};
