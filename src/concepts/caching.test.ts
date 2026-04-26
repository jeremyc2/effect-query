import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSome, assertSuccess } from "../testing-utils.ts";

test("caching shares runtime-backed data across setData, peek, and mounted query atoms", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			let calls = 0;
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				staleTime: "1 hour",
				queryFn: (id: string) =>
					Effect.sync(() => {
						calls += 1;
						return `${id}:fetched`;
					}),
			});

			yield* userQuery.setData("1", "1:seeded");
			const peeked = yield* userQuery.peek("1");
			assertSome(peeked);
			assertSuccess(peeked.value);
			expect(peeked.value.data).toBe("1:seeded");

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			const current = registry.get(atom);
			assertSuccess(current);
			expect(current.data).toBe("1:seeded");
			expect(calls).toBe(0);
			release();
		}),
	));
