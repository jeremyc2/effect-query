import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";
import { assertSome, assertSuccess } from "../testing-utils.ts";

test("initial query data seeds the cache before the first fetch", async () => {
	const runtime = makeRuntime();
	let calls = 0;
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		initialData: (id: string) => `${id}:seeded`,
		staleTime: "1 hour",
		queryFn: (id: string) =>
			Effect.sync(() => {
				calls += 1;
				return `${id}:fetched`;
			}),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	const current = registry.get(atom);
	assertSuccess(current);
	expect(current.value).toBe("1:seeded");
	expect(calls).toBe(0);

	const peeked = await Effect.runPromise(userQuery.peek("1"));
	assertSome(peeked);
	assertSuccess(peeked.value);
	expect(peeked.value.value).toBe("1:seeded");
	release();
});
