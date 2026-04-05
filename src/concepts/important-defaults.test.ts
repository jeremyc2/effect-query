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

test("important defaults refetch stale active queries on window focus", async () => {
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
	await Effect.runPromise(waitForQuerySuccess(registry, atom));

	version = "v2";
	await Effect.runPromise(provideRuntime(runtime, onWindowFocus));
	expect(
		(await Effect.runPromise(waitForQuerySuccess(registry, atom))).data,
	).toBe("1:v2");
	release();
});
