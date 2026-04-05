import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSuccess, waitForQuerySuccess } from "../testing-utils.ts";

test("queries keep previous success visible while a refresh is waiting", async () => {
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

	await Effect.runPromise(waitForQuerySuccess(registry, atom));

	version = "v2";
	registry.refresh(atom);
	await Effect.runPromise(Effect.sleep("0 millis"));

	const duringRefetch = registry.get(atom);
	assertSuccess(duringRefetch);
	expect(duringRefetch.isFetching).toBe(true);
	expect(duringRefetch.data).toBe("1:v1");

	const resolved = await Effect.runPromise(waitForQuerySuccess(registry, atom));
	expect(resolved.data).toBe("1:v2");
	release();
});
