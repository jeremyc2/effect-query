import { expect, test } from "bun:test";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createMutationAtom } from "../EffectQuery.ts";
import {
	assertMutationError,
	waitForMutationError,
	waitForMutationSuccess,
} from "../testing-utils.ts";

test("mutation atoms expose idle, pending, and success states", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const addUser = createMutationAtom({
				mutationFn: Effect.fnUntraced(function* (name: string) {
					yield* Effect.sleep("10 millis");
					return `created:${name}`;
				}),
			});

			const registry = AtomRegistry.make();
			const release = registry.mount(addUser);

			expect(registry.get(addUser).status).toBe("idle");
			registry.set(addUser, "ada");
			expect(registry.get(addUser).status).toBe("pending");

			const result = yield* waitForMutationSuccess(registry, addUser);
			expect(result.data).toBe("created:ada");
			release();
		}),
	));

test("mutation atoms expose errors without leaking raw async-result fields", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const createUser = createMutationAtom({
				mutationFn: () => Effect.fail("duplicate-user"),
			});

			const registry = AtomRegistry.make();
			const release = registry.mount(createUser);
			registry.set(createUser, undefined);

			const result = yield* waitForMutationError(registry, createUser);
			assertMutationError(result);
			expect(result.status).toBe("error");
			expect(result.error).toBe("duplicate-user");
			expect(result.failureCause.pipe(Cause.pretty)).toContain(
				"duplicate-user",
			);
			release();
		}),
	));
