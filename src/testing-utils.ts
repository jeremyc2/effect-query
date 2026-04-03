import { expect } from "bun:test";
import type * as Option from "effect/Option";
import * as OptionValue from "effect/Option";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AsyncResultValue from "effect/unstable/reactivity/AsyncResult";

export const assert: (condition: boolean) => asserts condition = (
	condition,
) => {
	expect(condition).toBe(true);
};

export const assertSome: <A>(
	value: Option.Option<A>,
) => asserts value is Option.Some<A> = (value) => {
	assert(value.pipe(OptionValue.isSome));
};

export const assertSuccess: <A, E>(
	value: AsyncResult.AsyncResult<A, E>,
) => asserts value is AsyncResult.Success<A, E> = (value) => {
	assert(value.pipe(AsyncResultValue.isSuccess));
};
