import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import {
	hasMutationRuntime,
	normalizeMutationResult,
	resolveMutationFn,
} from "../core.ts";
import { defaultRuntime } from "../runtime.ts";
import { QueryStore } from "../store.ts";
import type {
	MutationAtom,
	MutationAtomFactory,
	MutationAtomFactoryInput,
	MutationAtomFactoryOptions,
	MutationInput,
	MutationOptions,
	QueryRuntime,
} from "../types.ts";

function createMutationAtomWithRuntime<Arg, A, E = never, R = never>(
	runtime: QueryRuntime<R>,
	options: MutationOptions<Arg, A, E, R>,
): MutationAtom<Arg, A, E> {
	const mutation = runtime.fn(
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

	return Atom.transform(mutation, (get) =>
		normalizeMutationResult(get(mutation)),
	);
}

export function createMutationAtom<Arg, A, E = never>(
	options: MutationOptions<Arg, A, E, never>,
): MutationAtom<Arg, A, E>;
export function createMutationAtom<Arg, A, E = never, R = never>(
	options: MutationOptions<Arg, A, E, R> & {
		readonly runtime: QueryRuntime<R>;
	},
): MutationAtom<Arg, A, E>;
export function createMutationAtom<Arg, A, E = never, R = never>(
	options: MutationInput<Arg, A, E, R>,
): MutationAtom<Arg, A, E> {
	if (!hasMutationRuntime(options)) {
		return createMutationAtomWithRuntime<Arg, A, E, never>(
			defaultRuntime,
			options,
		);
	}
	return createMutationAtomWithRuntime<Arg, A, E, R>(options.runtime, options);
}

function createMutationAtomFactoryWithRuntime<
	FactoryArg,
	Arg,
	A,
	E = never,
	R = never,
>(
	runtime: QueryRuntime<R>,
	options: MutationAtomFactoryOptions<FactoryArg, Arg, A, E, R>,
): MutationAtomFactory<FactoryArg, Arg, A, E> {
	const resolveMutationKey = (factoryArg: FactoryArg) =>
		typeof options.mutationKey === "function"
			? options.mutationKey(factoryArg)
			: options.mutationKey;
	const invalidate = options.invalidate;
	const onSuccess = options.onSuccess;

	return Atom.family((factoryArg: FactoryArg) =>
		createMutationAtomWithRuntime(runtime, {
			mutationKey: resolveMutationKey(factoryArg),
			invalidate:
				invalidate === undefined
					? undefined
					: (arg, result) => invalidate(factoryArg, arg, result),
			onSuccess:
				onSuccess === undefined
					? undefined
					: (result, arg) => onSuccess(factoryArg, result, arg),
			concurrent: options.concurrent,
			initialValue: options.initialValue,
			mutationFn: (arg) => options.mutationFn(factoryArg, arg),
		}),
	);
}

export function createMutationAtomFactory<FactoryArg, Arg, A, E = never>(
	options: MutationAtomFactoryOptions<FactoryArg, Arg, A, E, never>,
): MutationAtomFactory<FactoryArg, Arg, A, E>;
export function createMutationAtomFactory<
	FactoryArg,
	Arg,
	A,
	E = never,
	R = never,
>(
	options: MutationAtomFactoryOptions<FactoryArg, Arg, A, E, R> & {
		readonly runtime: QueryRuntime<R>;
	},
): MutationAtomFactory<FactoryArg, Arg, A, E>;
export function createMutationAtomFactory<
	FactoryArg,
	Arg,
	A,
	E = never,
	R = never,
>(
	options: MutationAtomFactoryInput<FactoryArg, Arg, A, E, R>,
): MutationAtomFactory<FactoryArg, Arg, A, E> {
	if (!("runtime" in options) || options.runtime === undefined) {
		return createMutationAtomFactoryWithRuntime<FactoryArg, Arg, A, E, never>(
			defaultRuntime,
			options,
		);
	}
	const { runtime, ...optionsWithoutRuntime } = options;
	return createMutationAtomFactoryWithRuntime<FactoryArg, Arg, A, E, R>(
		runtime,
		optionsWithoutRuntime,
	);
}

export function mutationOptions<Arg, A, E = never, R = never>(
	options: MutationOptions<Arg, A, E, R>,
): MutationOptions<Arg, A, E, R> {
	return options;
}
