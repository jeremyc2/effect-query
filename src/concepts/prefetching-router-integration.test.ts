import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSuccess } from "../testing-utils.ts";

test("prefetching warms the cache before the query atom mounts", async () => {
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

	await Effect.runPromise(userQuery.prefetch("1"));
	expect(calls).toBe(1);

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	const current = registry.get(atom);
	assertSuccess(current);
	expect(current.data).toBe("1:fetched");
	expect(calls).toBe(1);
	release();
});
