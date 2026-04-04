import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
	DataUpdater,
	QueryFailure,
	QueryPending,
	QueryResult,
	QuerySuccess,
} from "../types.ts";

class QueryResultMissingError extends Schema.TaggedErrorClass<QueryResultMissingError>()(
	"QueryResultMissingError",
	{},
) {}

type QueryPendingState<A, E> = Omit<
	QueryPending<A, E>,
	keyof AsyncResult.Initial<A, E>
>;

type QuerySuccessState<A, E> = Omit<
	QuerySuccess<A, E>,
	keyof AsyncResult.Success<A, E>
>;

type QueryFailureState<A, E> = Omit<
	QueryFailure<A, E>,
	keyof AsyncResult.Failure<A, E>
>;

function attachQueryState<A, E, R extends AsyncResult.AsyncResult<A, E>, S>(
	result: R,
	state: S,
): R & S {
	return Object.assign(result, state);
}

export function normalizeQueryResult<A, E>(
	result: AsyncResult.AsyncResult<A, E>,
): QueryResult<A, E> {
	if (AsyncResult.isInitial(result)) {
		const state: QueryPendingState<A, E> = {
			status: "pending",
			fetchStatus: result.waiting ? "fetching" : "idle",
			isPending: true,
			isSuccess: false,
			isError: false,
			isFetching: result.waiting,
			isRefetching: false,
			data: undefined,
			error: undefined,
			failureCause: undefined,
			dataUpdatedAt: 0,
			valueOrUndefined: undefined,
		};
		return attachQueryState(result, state);
	}

	if (AsyncResult.isSuccess(result)) {
		const state: QuerySuccessState<A, E> = {
			status: "success",
			fetchStatus: result.waiting ? "fetching" : "idle",
			isPending: false,
			isSuccess: true,
			isError: false,
			isFetching: result.waiting,
			isRefetching: result.waiting,
			data: result.value,
			error: undefined,
			failureCause: undefined,
			dataUpdatedAt: result.timestamp,
			valueOrUndefined: result.value,
		};
		return attachQueryState(result, state);
	}

	const data = getCurrentSuccess(result).pipe(Option.getOrUndefined);
	const error = Cause.findErrorOption(result.cause).pipe(Option.getOrUndefined);
	const state: QueryFailureState<A, E> = {
		status: "error",
		fetchStatus: result.waiting ? "fetching" : "idle",
		isPending: false,
		isSuccess: false,
		isError: true,
		isFetching: result.waiting,
		isRefetching: result.waiting,
		data,
		error,
		failureCause: result.cause,
		dataUpdatedAt: Option.isSome(result.previousSuccess)
			? result.previousSuccess.value.timestamp
			: 0,
		valueOrUndefined: data,
	};
	return attachQueryState(result, state);
}

export function flattenObservedResult<A, E>(
	result: AsyncResult.AsyncResult<QueryResult<A, E>, never>,
): QueryResult<A, E> {
	if (AsyncResult.isInitial(result)) {
		return normalizeQueryResult(AsyncResult.initial(result.waiting));
	}
	if (AsyncResult.isFailure(result)) {
		return initialQueryResult();
	}
	return normalizeQueryResult(result.value);
}

export function initialQueryResult<A = never, E = never>(
	waiting = false,
): QueryResult<A, E> {
	return normalizeQueryResult(AsyncResult.initial(waiting));
}

export function successQueryResult<A, E = never>(
	value: A,
	options?: {
		readonly waiting?: boolean | undefined;
		readonly timestamp?: number | undefined;
	},
): QueryResult<A, E> {
	return normalizeQueryResult(AsyncResult.success(value, options));
}

export function failureQueryResult<A, E = never>(
	cause: Cause.Cause<E>,
	options?: {
		readonly previousSuccess?:
			| Option.Option<AsyncResult.Success<A, E>>
			| undefined;
		readonly waiting?: boolean | undefined;
	},
): QueryResult<A, E> {
	return normalizeQueryResult(AsyncResult.failure(cause, options));
}

export function waitingFromPrevious<A, E>(
	previous: Option.Option<QueryResult<A, E>>,
): QueryResult<A, E> {
	const rawPrevious: Option.Option<AsyncResult.AsyncResult<A, E>> = previous;
	return rawPrevious.pipe(AsyncResult.waitingFrom, normalizeQueryResult);
}

export function fromExitWithPrevious<A, E>(
	exit: Exit.Exit<A, E>,
	previous: Option.Option<QueryResult<A, E>>,
): QueryResult<A, E> {
	const rawPrevious: Option.Option<AsyncResult.AsyncResult<A, E>> = previous;
	return normalizeQueryResult(
		AsyncResult.fromExitWithPrevious(exit, rawPrevious),
	);
}

export function isInterruptedCause<E>(cause: Cause.Cause<E>): boolean {
	return (
		cause.reasons.length > 0 &&
		cause.reasons.every((reason) => Cause.isInterruptReason(reason))
	);
}

export function resolveCompletedResult<A, E>(
	result: QueryResult<A, E>,
): Effect.Effect<A, E> {
	if (result.isSuccess) {
		return Effect.succeed(result.data);
	}
	if (result.isError) {
		return Effect.failCause(result.failureCause);
	}
	return Effect.die(new QueryResultMissingError());
}

export function applyDataUpdater<A>(
	updater: DataUpdater<A>,
	current: Option.Option<A>,
): A {
	return typeof updater === "function"
		? Reflect.apply(updater, undefined, [current])
		: updater;
}

export function getCurrentSuccess<A, E>(
	result: QueryResult<A, E> | AsyncResult.AsyncResult<A, E>,
): Option.Option<A> {
	if (AsyncResult.isSuccess(result)) {
		return Option.some(result.value);
	}
	if (AsyncResult.isFailure(result) && Option.isSome(result.previousSuccess)) {
		return Option.some(result.previousSuccess.value.value);
	}
	return Option.none();
}
