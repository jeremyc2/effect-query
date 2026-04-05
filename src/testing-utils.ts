import { expect } from "bun:test";
import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as OptionValue from "effect/Option";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type {
	MutationFailure,
	MutationResult,
	MutationSuccess,
	QueryPending,
	QueryResult,
	QuerySuccess,
} from "./EffectQuery.ts";

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
	value: QueryResult<A, E>,
) => asserts value is QuerySuccess<A> = (value) => {
	assert(value.isSuccess);
};

export const assertPending: <A, E>(
	value: QueryResult<A, E>,
) => asserts value is QueryPending = (value) => {
	assert(value.isPending);
};

export const assertMutationSuccess: <A, E>(
	value: MutationResult<A, E>,
) => asserts value is MutationSuccess<A> = (value) => {
	assert(value.isSuccess);
};

export const assertMutationError: <A, E>(
	value: MutationResult<A, E>,
) => asserts value is MutationFailure<A, E> = (value) => {
	assert(value.isError);
};

export const waitForQuerySuccess = Effect.fnUntraced(function* <A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<QueryResult<A, E>>,
) {
	const current = registry.get(atom);
	if (current.isSuccess && !current.isFetching) {
		return current;
	}

	return yield* Effect.callback<QuerySuccess<A>, never>((resume) => {
		const unsubscribe = registry.subscribe(atom, (next) => {
			if (!next.isSuccess || next.isFetching) {
				return;
			}
			unsubscribe();
			resume(Effect.succeed(next));
		});

		return Effect.sync(unsubscribe);
	});
});

export const waitForMutationSuccess = Effect.fnUntraced(function* <A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<MutationResult<A, E>>,
) {
	const current = registry.get(atom);
	if (current.isSuccess) {
		return current;
	}

	return yield* Effect.callback<MutationSuccess<A>, never>((resume) => {
		const unsubscribe = registry.subscribe(atom, (next) => {
			if (!next.isSuccess) {
				return;
			}
			unsubscribe();
			resume(Effect.succeed(next));
		});

		return Effect.sync(unsubscribe);
	});
});

export const waitForMutationError = Effect.fnUntraced(function* <A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<MutationResult<A, E>>,
) {
	const current = registry.get(atom);
	if (current.isError) {
		return current;
	}

	return yield* Effect.callback<MutationFailure<A, E>, never>((resume) => {
		const unsubscribe = registry.subscribe(atom, (next) => {
			if (!next.isError) {
				return;
			}
			unsubscribe();
			resume(Effect.succeed(next));
		});

		return Effect.sync(unsubscribe);
	});
});
