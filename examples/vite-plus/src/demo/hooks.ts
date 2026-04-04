import * as Effect from "effect/Effect";
import type * as AtomType from "effect/unstable/reactivity/Atom";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { useEffect, useSyncExternalStore } from "react";
import { useDemo } from "./context.tsx";

export function useAtomValue<A>(atom: AtomType.Atom<A>): A {
	const { registry } = useDemo();

	useEffect(() => registry.mount(atom), [atom, registry]);

	return useSyncExternalStore(
		(onStoreChange) => registry.subscribe(atom, onStoreChange),
		() => registry.get(atom),
		() => registry.get(atom),
	);
}

export function useAtomSet<R, W>(atom: AtomType.Writable<R, W>) {
	const { registry } = useDemo();
	return (value: W) => {
		registry.set(atom, value);
	};
}

export function useAtomUpdate<R, W>(atom: AtomType.Writable<R, W>) {
	const { registry } = useDemo();
	return (update: (current: R) => W) => {
		registry.update(atom, update);
	};
}

export function useMutation<Arg, A, E>(
	mutationAtom: AtomType.AtomResultFn<Arg, A, E>,
) {
	const { registry } = useDemo();
	const result = useAtomValue(mutationAtom);
	const runEffect = Effect.fnUntraced(function* (arg: Arg) {
		yield* Effect.sync(() => {
			registry.set(mutationAtom, Atom.Reset);
			registry.set(mutationAtom, arg);
		});
		return yield* AtomRegistry.getResult(registry, mutationAtom, {
			suspendOnWaiting: true,
		});
	});

	return {
		result,
		run: (arg: Arg) => {
			void Effect.runFork(runEffect(arg));
		},
		runEffect,
	};
}
