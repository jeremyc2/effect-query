import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";
import { assertSuccess, waitForQuerySuccess } from "../testing-utils.ts";

test("polling refetches active queries on the refetch interval", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let calls = 0;
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				staleTime: "1 hour",
				refetchInterval: "10 millis",
				queryFn: (id: string) =>
					Effect.sync(() => {
						calls += 1;
						return `${id}:${calls}`;
					}),
			});

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			yield* waitForQuerySuccess(registry, atom);
			yield* Effect.sleep("35 millis");

			const current = registry.get(atom);
			assertSuccess(current);
			expect(current.data).not.toBe("1:1");
			expect(calls).toBeGreaterThanOrEqual(2);
			release();
		}),
	));
