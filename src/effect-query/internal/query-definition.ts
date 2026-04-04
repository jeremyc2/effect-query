import * as Duration from "effect/Duration";
import type * as Effect from "effect/Effect";
import type * as Schedule from "effect/Schedule";
import type {
	CreateQueryAtomInput,
	InternalQuery,
	MutationInput,
	MutationOptions,
	QueryAtomFactoryInput,
	QueryAtomFactoryOptions,
	QueryRuntime,
	QueryRuntimeWithLayer,
	ResolvedQueryPolicy,
} from "../types.ts";
import {
	defaultPolicy,
	QueryRuntimeLayerId,
	QueryRuntimeStateId,
} from "../types.ts";
import { hashQueryKey } from "./query-key.ts";

export function makeDefinition<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): InternalQuery<Arg, A, E, R> {
	return {
		key: options.queryKey,
		query: options.queryFn,
		reactivityKeys: options.reactivityKeys ?? (() => undefined),
		enabled: resolveEnabled(options),
		initialData: resolveInitialData(options),
		initialDataUpdatedAt: resolveInitialDataUpdatedAt(options),
		placeholderData: resolvePlaceholderData(options),
		policy: resolvePolicy(options),
		schema: options.schema,
		label: resolveLabel(options),
		entries: new Map(),
	};
}

export function resolvePolicy<E, R>(options: {
	readonly staleTime?: Duration.Input | undefined;
	readonly gcTime?: Duration.Input | undefined;
	readonly networkMode?: "online" | "always" | "offlineFirst" | undefined;
	readonly refetchInterval?: Duration.Input | false | undefined;
	readonly retry?: Schedule.Schedule<unknown, E, never, R> | undefined;
	readonly refetchOnMount?: boolean | undefined;
	readonly refetchOnWindowFocus?: boolean | undefined;
	readonly refetchOnReconnect?: boolean | undefined;
}): ResolvedQueryPolicy<E, R> {
	return {
		staleTimeMs: toMillis(options.staleTime ?? defaultPolicy.staleTime),
		gcTimeMs: toMillis(options.gcTime ?? defaultPolicy.gcTime),
		networkMode: options.networkMode ?? defaultPolicy.networkMode,
		refetchIntervalMs: toOptionalMillis(
			options.refetchInterval ?? defaultPolicy.refetchInterval,
		),
		retry: options.retry,
		refetchOnMount: options.refetchOnMount ?? defaultPolicy.refetchOnMount,
		refetchOnWindowFocus:
			options.refetchOnWindowFocus ?? defaultPolicy.refetchOnWindowFocus,
		refetchOnReconnect:
			options.refetchOnReconnect ?? defaultPolicy.refetchOnReconnect,
	};
}

export function resolveLabel<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): (arg: Arg) => string {
	const label = options.label;
	if (typeof label === "function") {
		return label;
	}
	return (arg: Arg) =>
		label ?? `effect-query:${hashQueryKey(options.queryKey(arg))}`;
}

export function resolveMutationFn<Arg, A, E, R>(
	options: MutationOptions<Arg, A, E, R>,
): (arg: Arg) => Effect.Effect<A, E, R> {
	return options.mutationFn;
}

export function resolveEnabled<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): (arg: Arg) => boolean {
	const enabled = options.enabled;
	if (typeof enabled === "function") {
		return enabled;
	}
	return () => enabled ?? true;
}

export function resolveInitialData<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): (arg: Arg) => A | undefined {
	const initialData = options.initialData;
	if (initialData === undefined) {
		return () => undefined;
	}
	if (initialData instanceof Function) {
		return (arg: Arg) => Reflect.apply(initialData, undefined, [arg]);
	}
	return () => initialData;
}

export function resolveInitialDataUpdatedAt<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): (arg: Arg) => number | undefined {
	const updatedAt = options.initialDataUpdatedAt;
	if (updatedAt === undefined) {
		return () => undefined;
	}
	return typeof updatedAt === "function"
		? (arg: Arg) => updatedAt(arg)
		: () => updatedAt;
}

export function resolvePlaceholderData<Arg, A, E, R>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): (arg: Arg, previousValue: A | undefined) => A | undefined {
	const placeholderData = options.placeholderData;
	if (placeholderData === undefined) {
		return () => undefined;
	}
	if (placeholderData instanceof Function) {
		return (arg: Arg, previousValue: A | undefined) =>
			Reflect.apply(placeholderData, undefined, [arg, previousValue]);
	}
	return () => placeholderData;
}

export function hasRuntimeState<R, E>(
	runtime: QueryRuntime<R, E>,
): runtime is QueryRuntimeWithLayer<R, E> {
	return QueryRuntimeLayerId in runtime && QueryRuntimeStateId in runtime;
}

export function hasQueryAtomFactoryRuntime<Arg, A, E, R>(
	options: QueryAtomFactoryInput<Arg, A, E, R>,
): options is QueryAtomFactoryOptions<Arg, A, E, R> & {
	readonly runtime: QueryRuntime<R>;
} {
	return options.runtime !== undefined;
}

export function hasMutationRuntime<Arg, A, E, R>(
	options: MutationInput<Arg, A, E, R>,
): options is {
	readonly runtime: QueryRuntime<R>;
} & MutationInput<Arg, A, E, R> {
	return options.runtime !== undefined;
}

export function hasCreateQueryAtomRuntime<A, E, R>(
	options: CreateQueryAtomInput<A, E, R>,
): options is CreateQueryAtomInput<A, E, R> & {
	readonly runtime: QueryRuntime<R>;
} {
	return options.runtime !== undefined;
}

export function toMillis(input: Duration.Input): number {
	return Duration.toMillis(Duration.fromInputUnsafe(input));
}

export function toOptionalMillis(
	input: Duration.Input | false,
): number | undefined {
	return input === false ? undefined : toMillis(input);
}
