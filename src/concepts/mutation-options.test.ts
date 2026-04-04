import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createMutationAtomFactory, mutationOptions } from "../EffectQuery.ts";

test("mutation atom factories can parameterize mutation atoms by argument", async () => {
	const options = mutationOptions({
		mutationFn: (name: string) => Effect.succeed(`created:${name}`),
	});

	const createUserMutationFactory = createMutationAtomFactory({
		mutationFn: (teamId: string, name: string) =>
			options.mutationFn(`${teamId}:${name}`),
	});

	const registry = AtomRegistry.make();
	const createUser = createUserMutationFactory("team-1");
	const release = registry.mount(createUser);
	registry.set(createUser, "ada");

	expect(
		await Effect.runPromise(
			AtomRegistry.getResult(registry, createUser, {
				suspendOnWaiting: true,
			}),
		),
	).toBe("created:team-1:ada");
	release();
});
