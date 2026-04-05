import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
	MutationFailure,
	MutationIdle,
	MutationPending,
	MutationResult,
	MutationSuccess,
} from "../types.ts";

export function normalizeMutationResult<A, E>(
	result: AsyncResult.AsyncResult<A, E>,
): MutationResult<A, E> {
	if (AsyncResult.isInitial(result)) {
		if (!result.waiting) {
			const idle: MutationIdle = {
				status: "idle",
				isIdle: true,
				isPending: false,
				isSuccess: false,
				isError: false,
				data: undefined,
				error: undefined,
				failureCause: undefined,
			};
			return idle;
		}

		const pending: MutationPending<A> = {
			status: "pending",
			isIdle: false,
			isPending: true,
			isSuccess: false,
			isError: false,
			data: undefined,
			error: undefined,
			failureCause: undefined,
		};
		return pending;
	}

	if (result.waiting) {
		const pending: MutationPending<A> = {
			status: "pending",
			isIdle: false,
			isPending: true,
			isSuccess: false,
			isError: false,
			data: getCurrentSuccess(result).pipe(Option.getOrUndefined),
			error: undefined,
			failureCause: undefined,
		};
		return pending;
	}

	if (AsyncResult.isSuccess(result)) {
		const success: MutationSuccess<A> = {
			status: "success",
			isIdle: false,
			isPending: false,
			isSuccess: true,
			isError: false,
			data: result.value,
			error: undefined,
			failureCause: undefined,
		};
		return success;
	}

	const failure: MutationFailure<A, E> = {
		status: "error",
		isIdle: false,
		isPending: false,
		isSuccess: false,
		isError: true,
		data: getCurrentSuccess(result).pipe(Option.getOrUndefined),
		error: Cause.findErrorOption(result.cause).pipe(Option.getOrUndefined),
		failureCause: result.cause,
	};
	return failure;
}

function getCurrentSuccess<A, E>(
	result: AsyncResult.AsyncResult<A, E>,
): Option.Option<A> {
	if (AsyncResult.isSuccess(result)) {
		return Option.some(result.value);
	}
	if (AsyncResult.isFailure(result) && Option.isSome(result.previousSuccess)) {
		return Option.some(result.previousSuccess.value.value);
	}
	return Option.none();
}
