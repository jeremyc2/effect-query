import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	onOffline,
	onReconnect,
	provideRuntime,
} from "../EffectQuery.ts";

test("networkMode online pauses fetches while offline and resumes on reconnect", async () => {
	const runtime = makeRuntime();
	let calls = 0;
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		networkMode: "online",
		queryFn: (id) =>
			Effect.sync(() => {
				calls += 1;
				return `${id}:${calls}`;
			}),
	});

	await Effect.runPromise(provideRuntime(runtime, onOffline));

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(Effect.sleep("0 millis"));

	expect(calls).toBe(0);
	const paused = registry.get(atom);
	expect(paused.pipe(AsyncResult.isInitial)).toBe(true);
	expect(paused.waiting).toBe(true);

	await Effect.runPromise(provideRuntime(runtime, onReconnect));
	expect(
		await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		),
	).toBe("1:1");
	release();
});

test("networkMode always keeps fetching even while offline", async () => {
	const runtime = makeRuntime();
	let calls = 0;
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		networkMode: "always",
		queryFn: (id) =>
			Effect.sync(() => {
				calls += 1;
				return `${id}:${calls}`;
			}),
	});

	await Effect.runPromise(provideRuntime(runtime, onOffline));
	expect(await Effect.runPromise(userQuery.ensure("1"))).toBe("1:1");
	expect(calls).toBe(1);
});
