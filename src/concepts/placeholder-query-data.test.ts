import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";
import { assertSome, waitForQuerySuccess } from "../testing-utils.ts";

test("placeholder query data is shown during the initial fetch without persisting", async () => {
	const runtime = makeRuntime();
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		placeholderData: (id: string) => `${id}:placeholder`,
		queryFn: Effect.fnUntraced(function* (id: string) {
			yield* Effect.sleep("20 millis");
			return `${id}:fetched`;
		}),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(Effect.sleep("0 millis"));

	const current = registry.get(atom);
	expect(current.isSuccess).toBe(true);
	expect(current.isFetching).toBe(true);
	expect(current.data).toBe("1:placeholder");

	const peeked = await Effect.runPromise(userQuery.peek("1"));
	assertSome(peeked);
	expect(peeked.value.isPending).toBe(true);

	expect(
		(await Effect.runPromise(waitForQuerySuccess(registry, atom))).data,
	).toBe("1:fetched");
	release();
});
