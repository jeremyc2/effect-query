import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, dehydrate, hydrate } from "../EffectQuery.ts";
import { assertSuccess } from "../testing-utils.ts";

test("server rendering and hydration preserve successful query snapshots", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				staleTime: "1 hour",
				queryFn: (id: string) => Effect.succeed(`${id}:hydrated`),
			});

			const sourceRegistry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = sourceRegistry.mount(atom);
			yield* userQuery.ensure("1");

			const dehydrated = dehydrate(sourceRegistry);
			const targetRegistry = AtomRegistry.make();
			hydrate(targetRegistry, dehydrated);

			const hydrated = targetRegistry.get(atom);
			assertSuccess(hydrated);
			expect(hydrated.data).toBe("1:hydrated");
			release();
		}),
	));
