import type * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hash from "effect/Hash";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
	DataUpdater,
	InternalQuery,
	MutationInput,
	QueryCodec,
	QueryEntryBase,
	QueryFamilyInput,
	QueryFamilyOptions,
	QueryInput,
	QueryInputWithRuntime,
	QueryKey,
	QueryPolicy,
	QueryResult,
	QueryRuntime,
	QueryRuntimeWithLayer,
	ReactivityKeySet,
	ResolvedQueryPolicy,
} from "./types.ts";
import {
	defaultPolicy,
	QueryRuntimeLayerId,
	QueryRuntimeStateId,
} from "./types.ts";

class QueryResultMissingError extends Schema.TaggedErrorClass<QueryResultMissingError>()(
	"QueryResultMissingError",
	{},
) {}

export const makeDefinition = <Arg, A, E, R>(
	options: QueryFamilyOptions<Arg, A, E, R>,
): InternalQuery<Arg, A, E, R> => ({
	key: options.key,
	query: options.query,
	reactivityKeys: options.reactivityKeys ?? (() => undefined),
	policy: resolvePolicy(options.policy),
	schema: options.schema ?? defaultQueryCodec(),
	label: resolveLabel(options),
	entries: new Map(),
});

export const resolvePolicy = <E, R>(
	policy?: QueryPolicy<E, R>,
): ResolvedQueryPolicy<E, R> => ({
	staleTimeMs: toMillis(policy?.staleTime ?? defaultPolicy.staleTime),
	idleTimeToLiveMs: toMillis(
		policy?.idleTimeToLive ?? defaultPolicy.idleTimeToLive,
	),
	retry: policy?.retry,
	refetchOnMount: policy?.refetchOnMount ?? defaultPolicy.refetchOnMount,
	refetchOnWindowFocus:
		policy?.refetchOnWindowFocus ?? defaultPolicy.refetchOnWindowFocus,
	refetchOnReconnect:
		policy?.refetchOnReconnect ?? defaultPolicy.refetchOnReconnect,
});

export const flattenObservedResult = <A, E>(
	result: AsyncResult.AsyncResult<QueryResult<A, E>, never>,
): QueryResult<A, E> => {
	if (AsyncResult.isInitial(result)) {
		return AsyncResult.initial(result.waiting);
	}
	if (AsyncResult.isFailure(result)) {
		return AsyncResult.failure(result.cause);
	}
	return result.value;
};

export const resolveLabel = <Arg, A, E, R>(
	options: QueryFamilyOptions<Arg, A, E, R>,
): ((arg: Arg) => string) => {
	const label = options.label;
	if (typeof label === "function") {
		return label;
	}
	return (arg: Arg) =>
		label ?? `effect-query:${hashQueryKey(options.key(arg))}`;
};

export const hasRuntimeState = <R, E>(
	runtime: QueryRuntime<R, E>,
): runtime is QueryRuntimeWithLayer<R, E> =>
	QueryRuntimeLayerId in runtime && QueryRuntimeStateId in runtime;

export const hasQueryRuntime = <Arg, A, E, R>(
	options: QueryFamilyInput<Arg, A, E, R>,
): options is QueryFamilyOptions<Arg, A, E, R> & {
	readonly runtime: QueryRuntime<R>;
} => options.runtime !== undefined;

export const hasMutationRuntime = <Arg, A, E, R>(
	options: MutationInput<Arg, A, E, R>,
): options is {
	readonly runtime: QueryRuntime<R>;
	readonly run: (arg: Arg) => Effect.Effect<A, E, R>;
} & MutationInput<Arg, A, E, R> => options.runtime !== undefined;

export const hasQueryInputRuntime = <A, E, R>(
	options: QueryInput<A, E, R>,
): options is QueryInputWithRuntime<A, E, R> => options.runtime !== undefined;

export const defaultQueryCodec = <A, E>(): QueryCodec<A, E> =>
	AsyncResult.Schema({
		success: Schema.Any,
		error: Schema.Any,
	});

export const toMillis = (input: Duration.Input): number =>
	Duration.toMillis(Duration.fromInputUnsafe(input));

export const hashQueryKey = (key: QueryKey): string => stableSerialize(key);

const stableSerialize = (value: unknown): string => {
	const seen = new WeakSet<object>();

	const serialize = (current: unknown): string => {
		switch (typeof current) {
			case "string":
				return JSON.stringify(current);
			case "number":
			case "boolean":
				return String(current);
			case "bigint":
				return `${String(current)}n`;
			case "undefined":
				return "undefined";
			case "symbol":
				return current.toString();
			case "function":
				return `[function:${current.name || "anonymous"}]`;
			case "object": {
				if (current === null) {
					return "null";
				}

				if (current instanceof Date) {
					return `date:${current.toISOString()}`;
				}

				if (Array.isArray(current)) {
					return `[${current.map(serialize).join(",")}]`;
				}

				if (seen.has(current)) {
					return '"[circular]"';
				}
				seen.add(current);

				const entries = Object.entries(current).sort(([left], [right]) =>
					left.localeCompare(right),
				);
				return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${serialize(entryValue)}`).join(",")}}`;
			}
		}
	};

	return serialize(value);
};

export const toReactivityHashSet = (
	keys: ReactivityKeySet | undefined,
): ReadonlySet<string> => {
	const hashes = new Set<string>();
	if (keys === undefined) {
		return hashes;
	}

	if (Array.isArray(keys)) {
		for (const key of keys) {
			hashes.add(String(stringOrHash(key)));
		}
		return hashes;
	}

	if (!isReactivityKeyRecord(keys)) {
		return hashes;
	}

	for (const [key, ids] of Object.entries(keys)) {
		hashes.add(key);
		for (const id of ids) {
			hashes.add(`${key}:${String(stringOrHash(id))}`);
		}
	}

	return hashes;
};

const isReactivityKeyRecord = (
	keys: ReactivityKeySet,
): keys is Readonly<Record<string, ReadonlyArray<unknown>>> =>
	!Array.isArray(keys);

export const needsRefetchBase = (
	entry: QueryEntryBase,
	now: number,
): boolean => {
	const current = entry.snapshot();
	if (
		entry.invalidated ||
		AsyncResult.isInitial(current) ||
		AsyncResult.isFailure(current)
	) {
		return true;
	}
	return now - current.timestamp >= entry.policy.staleTimeMs;
};

export const resolveCompletedResult = <A, E>(
	result: QueryResult<A, E>,
): Effect.Effect<A, E> => {
	if (AsyncResult.isSuccess(result)) {
		return Effect.succeed(result.value);
	}
	if (AsyncResult.isFailure(result)) {
		return Effect.failCause(result.cause);
	}
	return Effect.die(new QueryResultMissingError());
};

const stringOrHash = (value: unknown): string | number => {
	switch (typeof value) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
			return String(value);
		default:
			return Hash.hash(value);
	}
};

export const applyDataUpdater = <A>(
	updater: DataUpdater<A>,
	current: Option.Option<A>,
): A =>
	typeof updater === "function"
		? Reflect.apply(updater, undefined, [current])
		: updater;

export const getCurrentSuccess = <A, E>(
	result: QueryResult<A, E>,
): Option.Option<A> => {
	if (AsyncResult.isSuccess(result)) {
		return Option.some(result.value);
	}
	if (AsyncResult.isFailure(result) && Option.isSome(result.previousSuccess)) {
		return Option.some(result.previousSuccess.value.value);
	}
	return Option.none();
};

export const isWaiting = AsyncResult.isWaiting;
export const isInitial = AsyncResult.isInitial;
export const isSuccess = AsyncResult.isSuccess;
export const isFailure = AsyncResult.isFailure;
export const getSuccess = <A, E>(result: QueryResult<A, E>): Option.Option<A> =>
	getCurrentSuccess(result);
export const getFailureCause = <A, E>(
	result: QueryResult<A, E>,
): Option.Option<Cause.Cause<E>> =>
	AsyncResult.isFailure(result) ? Option.some(result.cause) : Option.none();
