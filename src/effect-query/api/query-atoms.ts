import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
	flattenObservedResult,
	hasCreateQueryAtomRuntime,
	hashQueryKey,
	hasQueryAtomFactoryRuntime,
	makeDefinition,
	successQueryResult,
} from "../core.ts";
import { defaultRuntime, provideRuntime } from "../runtime.ts";
import { QueryStore } from "../store.ts";
import type {
	CreateQueryAtomInput,
	DataUpdater,
	QueryAtom,
	QueryAtomFactory,
	QueryAtomFactoryInput,
	QueryAtomFactoryOptions,
	QueryResult,
	QueryRuntime,
} from "../types.ts";

function applyPlaceholderData<Arg, A, E>(
	result: QueryResult<A, E>,
	definition: {
		readonly placeholderData: (
			arg: Arg,
			previousValue: A | undefined,
		) => A | undefined;
	},
	arg: Arg,
): QueryResult<A, E> {
	if (!result.isPending || !result.isFetching) {
		return result;
	}
	const placeholder = definition.placeholderData(arg, undefined);
	return placeholder === undefined
		? result
		: successQueryResult(placeholder, { waiting: true });
}

function toStaticQueryFn<A, E, R>(
	queryFn: CreateQueryAtomInput<A, E, R>["queryFn"],
): QueryAtomFactoryOptions<void, A, E, R>["queryFn"] {
	if (typeof queryFn === "function") {
		return (_arg, context) => queryFn(context);
	}
	return () => queryFn;
}

function createQueryAtomFactoryWithRuntime<Arg, A, E = never, R = never>(
	runtime: QueryRuntime<R>,
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): QueryAtomFactory<Arg, A, E> {
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
			applyPlaceholderData(
				flattenObservedResult(get(observed)),
				definition,
				arg,
			),
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

		if (definition.schema !== undefined) {
			atom = Atom.serializable(atom, {
				key: `effect-query:${hashQueryKey(definition.key(arg))}`,
				schema: definition.schema,
			});
		}
		atom = Atom.setIdleTTL(atom, definition.policy.gcTimeMs);
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
		cancel: (arg: Arg) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.cancel(definition, arg)),
			),
		setData: (arg: Arg, updater: DataUpdater<A>) =>
			provideRuntime(
				runtime,
				QueryStore.use((store) => store.setData(definition, arg, updater)),
			),
	});
}

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
	const queries = hasCreateQueryAtomRuntime(options)
		? createQueryAtomFactory({
				runtime: options.runtime,
				queryKey: () => options.queryKey,
				queryFn: toStaticQueryFn(options.queryFn),
				reactivityKeys: options.reactivityKeys,
				staleTime: options.staleTime,
				gcTime: options.gcTime,
				networkMode: options.networkMode,
				refetchInterval: options.refetchInterval,
				enabled: options.enabled,
				initialData: options.initialData,
				initialDataUpdatedAt: options.initialDataUpdatedAt,
				placeholderData: options.placeholderData,
				retry: options.retry,
				refetchOnMount: options.refetchOnMount,
				refetchOnWindowFocus: options.refetchOnWindowFocus,
				refetchOnReconnect: options.refetchOnReconnect,
				label: options.label,
				schema: options.schema,
			})
		: createQueryAtomFactory<void, A, E>({
				queryKey: () => options.queryKey,
				queryFn: toStaticQueryFn(options.queryFn),
				reactivityKeys: options.reactivityKeys,
				staleTime: options.staleTime,
				gcTime: options.gcTime,
				networkMode: options.networkMode,
				refetchInterval: options.refetchInterval,
				enabled: options.enabled,
				initialData: options.initialData,
				initialDataUpdatedAt: options.initialDataUpdatedAt,
				placeholderData: options.placeholderData,
				retry: options.retry,
				refetchOnMount: options.refetchOnMount,
				refetchOnWindowFocus: options.refetchOnWindowFocus,
				refetchOnReconnect: options.refetchOnReconnect,
				label: options.label,
				schema: options.schema,
			});
	const atom = queries(undefined);
	return Object.assign(atom, {
		key: () => queries.key(undefined),
		hash: () => queries.hash(undefined),
		prefetch: () => queries.prefetch(undefined),
		ensure: () => queries.ensure(undefined),
		peek: () => queries.peek(undefined),
		refresh: () => queries.refresh(undefined),
		cancel: () => queries.cancel(undefined),
		setData: (updater: DataUpdater<A>) => queries.setData(undefined, updater),
	});
}
