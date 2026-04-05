import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createMutationAtom, createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSuccess, waitForMutationSuccess } from "../testing-utils.ts";

test("updates from mutation responses can write directly into cached query data", async () => {
	const userQuery = createQueryAtomFactory({
		queryKey: (id: string) => ["user", id],
		queryFn: (id: string) => Effect.succeed(`${id}:before`),
	});
	const renameUser = createMutationAtom({
		mutationFn: (input: { readonly id: string; readonly name: string }) =>
			Effect.succeed(input.name),
		onSuccess: (name, input) =>
			userQuery.setData(input.id, `${input.id}:${name}`).pipe(Effect.asVoid),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const releaseQuery = registry.mount(atom);
	const releaseMutation = registry.mount(renameUser);
	await Effect.runPromise(userQuery.ensure("1"));

	registry.set(renameUser, { id: "1", name: "after" });
	await Effect.runPromise(waitForMutationSuccess(registry, renameUser));

	const current = registry.get(atom);
	assertSuccess(current);
	expect(current.data).toBe("1:after");

	releaseMutation();
	releaseQuery();
});
