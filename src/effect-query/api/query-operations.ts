import * as Effect from "effect/Effect";
import * as Hydration from "effect/unstable/reactivity/Hydration";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { QueryStore } from "../store.ts";
import type {
	DataUpdater,
	QueryAtomFactory,
	QueryAtomFactoryOptions,
	ReactivityKeySet,
} from "../types.ts";

export function queryOptions<Arg, A, E = never, R = never>(
	options: QueryAtomFactoryOptions<Arg, A, E, R>,
): QueryAtomFactoryOptions<Arg, A, E, R> {
	return options;
}

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

export const cancel = Effect.fn(function* <Arg, A, E>(
	queries: QueryAtomFactory<Arg, A, E>,
	arg: Arg,
) {
	yield* queries.cancel(arg);
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
export const onOffline = QueryStore.use((store) => store.onOffline);
export const onReconnect = QueryStore.use((store) => store.onOnline);

export const dehydrate = Hydration.dehydrate;
export const hydrate = Hydration.hydrate;
export type DehydratedAtom = Hydration.DehydratedAtom;
export type DehydratedAtomValue = Hydration.DehydratedAtomValue;
