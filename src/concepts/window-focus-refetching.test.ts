import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	onWindowFocus,
	provideRuntime,
} from "../EffectQuery.ts";

test("window focus refetching refreshes stale active queries", async () => {
	const runtime = makeRuntime();
	let version = "v1";
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		staleTime: "0 millis",
		refetchOnWindowFocus: true,
		queryFn: (id: string) =>
			Effect.sleep("5 millis").pipe(
				Effect.andThen(Effect.succeed(`${id}:${version}`)),
			),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(
		AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
	);
	version = "v2";

	await Effect.runPromise(provideRuntime(runtime, onWindowFocus));
	expect(
		await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		),
	).toBe("1:v2");
	release();
});
