import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";
import {
	assertPending,
	assertSuccess,
	waitForQuerySuccess,
} from "../testing-utils.ts";

test("query cancellation aborts in-flight work and restores the previous value", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let calls = 0;
			let aborted = false;
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				queryFn: (id, { signal }) => {
					calls += 1;
					if (calls === 1) {
						return Effect.succeed(`${id}:v1`);
					}
					return Effect.never.pipe(
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								aborted = signal.aborted;
							}),
						),
					);
				},
			});

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			yield* waitForQuerySuccess(registry, atom);

			yield* userQuery.refresh("1").pipe(
				Effect.catchCause(() => Effect.void),
				Effect.forkDetach,
			);
			yield* Effect.sleep("0 millis");
			const waiting = registry.get(atom);
			assertSuccess(waiting);
			expect(waiting.isFetching).toBe(true);

			yield* userQuery.cancel("1");
			yield* Effect.sleep("0 millis");

			expect(aborted).toBe(true);
			const current = registry.get(atom);
			assertSuccess(current);
			expect(current.isFetching).toBe(false);
			expect(current.data).toBe("1:v1");
			release();
		}),
	));

test("query cancellation resets an initial fetch back to the initial state", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				queryFn: (_id, { signal }) =>
					Effect.never.pipe(
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								expect(signal.aborted).toBe(true);
							}),
						),
					),
			});

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			yield* Effect.sleep("0 millis");

			yield* userQuery.cancel("1");
			yield* Effect.sleep("0 millis");

			const current = registry.get(atom);
			assertPending(current);
			expect(current.isFetching).toBe(false);
			release();
		}),
	));
