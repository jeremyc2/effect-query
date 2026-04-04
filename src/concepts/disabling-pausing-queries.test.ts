import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";

test("disabling queries keeps automatic work idle until refresh is called", async () => {
	const runtime = makeRuntime();
	let calls = 0;
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		enabled: false,
		queryFn: (id: string) =>
			Effect.sync(() => {
				calls += 1;
				return `${id}:fetched`;
			}),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(Effect.sleep("0 millis"));

	expect(calls).toBe(0);
	expect(await Effect.runPromise(userQuery.refresh("1"))).toBe("1:fetched");
	expect(calls).toBe(1);
	release();
});
