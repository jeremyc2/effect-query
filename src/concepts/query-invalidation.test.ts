import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	provideRuntime,
} from "../EffectQuery.ts";
import { QueryStore } from "../effect-query/store.ts";
import { assertSuccess, waitForQuerySuccess } from "../testing-utils.ts";

test("query invalidation refetches active matching queries", async () => {
	const runtime = makeRuntime();
	let version = "v1";
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		staleTime: "1 hour",
		reactivityKeys: (id: string) => ({
			user: [id],
		}),
		queryFn: (id: string) => Effect.succeed(`${id}:${version}`),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(waitForQuerySuccess(registry, atom));

	version = "v2";
	await Effect.runPromise(
		provideRuntime(
			runtime,
			QueryStore.use((store) => store.invalidate({ user: ["1"] })),
		),
	);
	await Effect.runPromise(Effect.sleep("0 millis"));

	const current = registry.get(atom);
	assertSuccess(current);
	expect(current.data).toBe("1:v2");
	release();
});
