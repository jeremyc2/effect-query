import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Atom from "effect/unstable/reactivity/Atom";
import { hasRuntimeState } from "./core.ts";
import { type QueryStore, QueryStoreLayer } from "./store.ts";
import type { QueryRuntime, QueryRuntimeWithLayer } from "./types.ts";
import { QueryRuntimeLayerId, QueryRuntimeStateId } from "./types.ts";

class QueryRuntimeMetadataMissingError extends Schema.TaggedErrorClass<QueryRuntimeMetadataMissingError>()(
	"QueryRuntimeMetadataMissingError",
	{},
) {}

export function makeRuntime(): QueryRuntimeWithLayer<never, never>;
export function makeRuntime<R, E>(
	layer: Layer.Layer<R, E>,
): QueryRuntimeWithLayer<R, E>;
export function makeRuntime<R, E>(
	layer?: Layer.Layer<R, E>,
): QueryRuntimeWithLayer<R, E> | QueryRuntimeWithLayer<never, never> {
	const runtimeFactory = Atom.context({
		memoMap: Layer.makeMemoMapUnsafe(),
	});
	if (layer === undefined) {
		return Object.assign(runtimeFactory(QueryStoreLayer), {
			[QueryRuntimeLayerId]: QueryStoreLayer,
			[QueryRuntimeStateId]: {
				scope: Scope.makeUnsafe(),
				lock: Semaphore.makeUnsafe(1),
				services: Option.none(),
			},
		});
	}

	const runtimeLayer = Layer.merge(layer, QueryStoreLayer);
	return Object.assign(runtimeFactory(runtimeLayer), {
		[QueryRuntimeLayerId]: runtimeLayer,
		[QueryRuntimeStateId]: {
			scope: Scope.makeUnsafe(),
			lock: Semaphore.makeUnsafe(1),
			services: Option.none(),
		},
	});
}

export const defaultRuntime = makeRuntime();

export const provideRuntime = <A, E, R = never>(
	runtime: QueryRuntime<R>,
	effect: Effect.Effect<A, E, QueryStore | R>,
): Effect.Effect<A, E> => {
	if (!hasRuntimeState(runtime)) {
		return Effect.die(new QueryRuntimeMetadataMissingError());
	}

	return Effect.gen(function* () {
		const state = runtime[QueryRuntimeStateId];
		const services = yield* state.lock.withPermit(
			Effect.gen(function* () {
				return Option.isSome(state.services)
					? state.services.value
					: yield* Layer.buildWithMemoMap(
							runtime[QueryRuntimeLayerId],
							runtime.factory.memoMap,
							state.scope,
						).pipe(
							Effect.tap((built) =>
								Effect.sync(() => {
									state.services = Option.some(built);
								}),
							),
						);
			}),
		);
		return yield* Effect.provideContext(effect, services);
	});
};
