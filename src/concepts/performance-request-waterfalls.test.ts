import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createQueryAtomFactory } from "../EffectQuery.ts";

test("concurrent ensures deduplicate to avoid request waterfalls", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			let calls = 0;
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				staleTime: "1 minute",
				queryFn: Effect.fnUntraced(function* (id: string) {
					calls += 1;
					yield* Effect.sleep("10 millis");
					return `${id}:${calls}`;
				}),
			});

			const [first, second] = yield* Effect.all([
				userQuery.ensure("1"),
				userQuery.ensure("1"),
			]);
			expect(first).toBe("1:1");
			expect(second).toBe("1:1");
			expect(calls).toBe(1);
		}),
	));
