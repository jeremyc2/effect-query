import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	onOffline,
	onReconnect,
	provideRuntime,
} from "../EffectQuery.ts";
import { assertPending, waitForQuerySuccess } from "../testing-utils.ts";

test("networkMode online pauses fetches while offline and resumes on reconnect", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let calls = 0;
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				networkMode: "online",
				queryFn: (id) =>
					Effect.sync(() => {
						calls += 1;
						return `${id}:${calls}`;
					}),
			});

			yield* provideRuntime(runtime, onOffline);

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			yield* Effect.sleep("0 millis");

			expect(calls).toBe(0);
			const paused = registry.get(atom);
			assertPending(paused);
			expect(paused.isFetching).toBe(true);

			yield* provideRuntime(runtime, onReconnect);
			expect((yield* waitForQuerySuccess(registry, atom)).data).toBe("1:1");
			release();
		}),
	));

test("networkMode always keeps fetching even while offline", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let calls = 0;
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				networkMode: "always",
				queryFn: (id) =>
					Effect.sync(() => {
						calls += 1;
						return `${id}:${calls}`;
					}),
			});

			yield* provideRuntime(runtime, onOffline);
			expect(yield* userQuery.ensure("1")).toBe("1:1");
			expect(calls).toBe(1);
		}),
	));
