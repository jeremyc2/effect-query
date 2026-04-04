import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createMutationAtom } from "../EffectQuery.ts";

test("mutations run their mutation function", async () => {
	const addUser = createMutationAtom({
		mutationFn: (name: string) => Effect.succeed(`created:${name}`),
	});

	const registry = AtomRegistry.make();
	const release = registry.mount(addUser);
	registry.set(addUser, "ada");

	expect(
		await Effect.runPromise(
			AtomRegistry.getResult(registry, addUser, { suspendOnWaiting: true }),
		),
	).toBe("created:ada");
	release();
});
