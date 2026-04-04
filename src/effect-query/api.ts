import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Hydration from "effect/unstable/reactivity/Hydration";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import {
	flattenObservedResult,
	getFailureCause,
	getSuccess,
	hasCreateQueryAtomRuntime,
	hashQueryKey,
	hasMutationRuntime,
	hasQueryAtomFactoryRuntime,
	isFailure,
	isInitial,
	isSuccess,
	isWaiting,
	makeDefinition,
	resolveMutationFn,
} from "./core.ts";
import { defaultRuntime, provideRuntime } from "./runtime.ts";
import { QueryStore } from "./store.ts";
import type {
	CreateQueryAtomInput,
	DataUpdater,
	MutationInput,
	MutationOptions,
	QueryAtom,
	QueryAtomFactory,
	QueryAtomFactoryInput,
	QueryAtomFactoryOptions,
	QueryRuntime,
	ReactivityKeySet,
} from "./types.ts";

const hasStaticQueryKey = <A, E, R>(
	options: CreateQueryAtomInput<A, E, R>,
): options is CreateQueryAtomInput<A, E, R> & {
	readonly queryKey: ReadonlyArray<unknown>;
} => "queryKey" in options && options.queryKey !== undefined;

const hasStaticQueryFn = <A, E, R>(
	options: CreateQueryAtomInput<A, E, R>,
): options is CreateQueryAtomInput<A, E, R> & {
	readonly queryFn: Effect.Effect<A, E, R>;
} => "queryFn" in options && options.queryFn !== undefined;

const createQueryAtomFactoryWithRuntime = <Arg, A, E = never, R = never>(
	runtime: QueryRuntime<R>,
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): QueryAtomFactory<Arg, A, E> => {
	const definition = makeDefinition(options);
	const atoms = Atom.family((arg: Arg) => {
		let refreshEpoch = 0;
		const refreshToken: Atom.Atom<number> = Atom.readable(() => refreshEpoch);

		const observed = runtime.subscriptionRef(
			Effect.fn(function* (get: Atom.Context) {
				const refreshCount = get(refreshToken);
				const store = yield* QueryStore;
				const ref = yield* store.observe(definition, arg);
				if (refreshCount > 0) {
					yield* store
						.refresh(definition, arg)
						.pipe(Effect.forkScoped, Effect.asVoid);
				}
				return ref;
			}),
		);

		const baseAtom = Atom.transform(observed, (get) =>
			flattenObservedResult(get(observed)),
		);
		let atom = Atom.readable(
			(get) => get(baseAtom),
			(refresh) => {
				refreshEpoch += 1;
				refresh(refreshToken);
			},
		);

		const reactivityKeys = definition.reactivityKeys(arg);
		if (reactivityKeys !== undefined) {
			atom = runtime.factory.withReactivity(reactivityKeys)(atom);
		}

		atom = Atom.serializable(atom, {
			key: `effect-query:${hashQueryKey(definition.key(arg))}`,
			schema: definition.schema,
		});
		atom = Atom.setIdleTTL(atom, definition.policy.idleTimeToLiveMs);
		return Atom.withLabel(atom, definition.label(arg));
	});

	return Object.assign(atoms, {
		key: definition.key,
		hash: (arg: Arg) => hashQueryKey(definition.key(arg)),
		prefetch: (arg: Arg) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.prefetch(definition, arg)),
			),
		ensure: (arg: Arg) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.ensure(definition, arg)),
			),
		peek: (arg: Arg) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.peek(definition, arg)),
			),
		refresh: (arg: Arg) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.refresh(definition, arg)),
			),
		setData: (arg: Arg, updater: DataUpdater<A>) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.setData(definition, arg, updater)),
			),
	});
};

export function createQueryAtomFactory<Arg, A, E = never>(
	options: QueryAtomFactoryOptions<Arg, A, E, never>,
): QueryAtomFactory<Arg, A, E>;
export function createQueryAtomFactory<Arg, A, E = never, R = never>(
	options: QueryAtomFactoryOptions<Arg, A, E, R> & {
		readonly runtime: QueryRuntime<R>;
	},
): QueryAtomFactory<Arg, A, E>;
export function createQueryAtomFactory<Arg, A, E = never, R = never>(
	options: QueryAtomFactoryInput<Arg, A, E, R>,
): QueryAtomFactory<Arg, A, E> {
	if (!hasQueryAtomFactoryRuntime(options)) {
		return createQueryAtomFactoryWithRuntime<Arg, A, E, never>(
			defaultRuntime,
			options,
		);
	}
	return createQueryAtomFactoryWithRuntime<Arg, A, E, R>(
		options.runtime,
		options,
	);
}

export function createQueryAtom<A, E = never>(
	options: CreateQueryAtomInput<A, E, never>,
): QueryAtom<A, E>;
export function createQueryAtom<A, E = never, R = never>(
	options: CreateQueryAtomInput<A, E, R> & {
		readonly runtime: QueryRuntime<R>;
	},
): QueryAtom<A, E>;
export function createQueryAtom<A, E = never, R = never>(
	options: CreateQueryAtomInput<A, E, R>,
): QueryAtom<A, E> {
	const queryKey = hasStaticQueryKey(options) ? options.queryKey : options.key;
	const queries = hasCreateQueryAtomRuntime(options)
		? (() => {
				const query = hasStaticQueryFn(options)
					? options.queryFn
					: options.query;
				return createQueryAtomFactory({
					runtime: options.runtime,
					key: () => queryKey,
					query: () => query,
					queryKey: () => queryKey,
					queryFn: () => query,
					reactivityKeys: options.reactivityKeys,
					staleTime: options.staleTime,
					gcTime: options.gcTime,
					idleTimeToLive: options.idleTimeToLive,
					retry: options.retry,
					refetchOnMount: options.refetchOnMount,
					refetchOnWindowFocus: options.refetchOnWindowFocus,
					refetchOnReconnect: options.refetchOnReconnect,
					policy: options.policy,
					label: options.label,
					schema: options.schema,
				});
			})()
		: (() => {
				const query = hasStaticQueryFn(options)
					? options.queryFn
					: options.query;
				return createQueryAtomFactory<void, A, E>({
					key: () => queryKey,
					query: () => query,
					queryKey: () => queryKey,
					queryFn: () => query,
					reactivityKeys: options.reactivityKeys,
					staleTime: options.staleTime,
					gcTime: options.gcTime,
					idleTimeToLive: options.idleTimeToLive,
					retry: options.retry,
					refetchOnMount: options.refetchOnMount,
					refetchOnWindowFocus: options.refetchOnWindowFocus,
					refetchOnReconnect: options.refetchOnReconnect,
					policy: options.policy,
					label: options.label,
					schema: options.schema,
				});
			})();
	const atom = queries(undefined);
	return Object.assign(atom, {
		key: () => queries.key(undefined),
		hash: () => queries.hash(undefined),
		prefetch: () => queries.prefetch(undefined),
		ensure: () => queries.ensure(undefined),
		peek: () => queries.peek(undefined),
		refresh: () => queries.refresh(undefined),
		setData: (updater: DataUpdater<A>) => queries.setData(undefined, updater),
	});
}

const mutationWithRuntime = <Arg, A, E = never, R = never>(
	runtime: QueryRuntime<R>,
	options: MutationOptions<Arg, A, E, R>,
): Atom.AtomResultFn<Arg, A, E> =>
	runtime.fn(
		Effect.fn(function* (arg: Arg) {
			const result = yield* resolveMutationFn(options)(arg);
			if (options.onSuccess !== undefined) {
				yield* options.onSuccess(result, arg);
			}

			const invalidation = options.invalidate?.(arg, result);
			if (invalidation !== undefined) {
				yield* QueryStore.use((store) => store.invalidate(invalidation));
				yield* Reactivity.invalidate(invalidation);
			}

			return result;
		}),
		{
			concurrent: options.concurrent,
			initialValue: options.initialValue,
		},
	);

export function mutation<Arg, A, E = never>(
	options: MutationOptions<Arg, A, E, never>,
): Atom.AtomResultFn<Arg, A, E>;
export function mutation<Arg, A, E = never, R = never>(
	options: MutationOptions<Arg, A, E, R> & {
		readonly runtime: QueryRuntime<R>;
	},
): Atom.AtomResultFn<Arg, A, E>;
export function mutation<Arg, A, E = never, R = never>(
	options: MutationInput<Arg, A, E, R>,
): Atom.AtomResultFn<Arg, A, E> {
	if (!hasMutationRuntime(options)) {
		return mutationWithRuntime<Arg, A, E, never>(defaultRuntime, options);
	}
	return mutationWithRuntime<Arg, A, E, R>(options.runtime, options);
}

export const queryOptions = <Arg, A, E = never, R = never>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): QueryAtomFactoryOptions<Arg, A, E, R> => options;

export const mutationOptions = <Arg, A, E = never, R = never>(
	options: MutationOptions<Arg, A, E, R>,
): MutationOptions<Arg, A, E, R> => options;

export const prefetch = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
) {
	yield* queries.prefetch(arg);
});

export const ensure = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
) {
	return yield* queries.ensure(arg);
});

export const refresh = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
) {
	return yield* queries.refresh(arg);
});

export const setData = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
	updater: DataUpdater<A>,
) {
	return yield* queries.setData(arg, updater);
});

export const peek = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
) {
	return yield* queries.peek(arg);
});

export const invalidate = Effect.fn(function* (keys: ReactivityKeySet) {
	yield* QueryStore.use((store) => store.invalidate(keys));
	yield* Reactivity.invalidate(keys);
});

export const onWindowFocus = QueryStore.use((store) => store.onFocus);
export const onReconnect = QueryStore.use((store) => store.onOnline);

export const dehydrate = Hydration.dehydrate;
export const hydrate = Hydration.hydrate;
export type DehydratedAtom = Hydration.DehydratedAtom;
export type DehydratedAtomValue = Hydration.DehydratedAtomValue;

export {
	getFailureCause,
	getSuccess,
	isFailure,
	isInitial,
	isSuccess,
	isWaiting,
};
