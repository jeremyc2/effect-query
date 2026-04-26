import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	onWindowFocus,
	provideRuntime,
} from "../EffectQuery.ts";
import { waitForQuerySuccess } from "../testing-utils.ts";

test("important defaults refetch stale active queries on window focus", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let version = "v1";
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				queryFn: (id: string) => Effect.succeed(`${id}:${version}`),
			});

			const registry = AtomRegistry.make();
			const atom = userQuery("1");
			const release = registry.mount(atom);
			yield* waitForQuerySuccess(registry, atom);

			version = "v2";
			yield* provideRuntime(runtime, onWindowFocus);
			expect((yield* waitForQuerySuccess(registry, atom)).data).toBe("1:v2");
			release();
		}),
	));
