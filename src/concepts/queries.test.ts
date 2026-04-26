import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import {
	assertSuccess,
	waitForQueryFetching,
	waitForQuerySuccess,
} from "../testing-utils.ts";

test("queries keep previous success visible while a refresh is waiting", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			let version = "v1";
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				queryFn: Effect.fnUntraced(function* (id: string) {
					yield* Effect.sleep("10 millis");
					return `${id}:${version}`;
				}),
			});

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);

			yield* waitForQuerySuccess(registry, atom);

			version = "v2";
			registry.refresh(atom);
			yield* waitForQueryFetching(registry, atom);

			const duringRefetch = registry.get(atom);
			assertSuccess(duringRefetch);
			expect(duringRefetch.isFetching).toBe(true);
			expect(duringRefetch.data).toBe("1:v1");

			const resolved = yield* waitForQuerySuccess(registry, atom);
			expect(resolved.data).toBe("1:v2");
			release();
		}),
	));
