import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";
import { assertSuccess } from "../testing-utils.ts";

test("query cancellation aborts in-flight work and restores the previous value", async () => {
	const runtime = makeRuntime();
	let calls = 0;
	let aborted = false;
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		queryFn: (id, { signal }) => {
			calls += 1;
			if (calls === 1) {
				return Effect.succeed(`${id}:v1`);
			}
			return Effect.never.pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						aborted = signal.aborted;
					}),
				),
			);
		},
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(
		AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
	);

	Effect.runFork(
		userQuery.refresh("1").pipe(Effect.catchCause(() => Effect.void)),
	);
	await Effect.runPromise(Effect.sleep("0 millis"));
	const waiting = registry.get(atom);
	assertSuccess(waiting);
	expect(waiting.waiting).toBe(true);

	await Effect.runPromise(userQuery.cancel("1"));
	await Effect.runPromise(Effect.sleep("0 millis"));

	expect(aborted).toBe(true);
	const current = registry.get(atom);
	assertSuccess(current);
	expect(current.waiting).toBe(false);
	expect(current.value).toBe("1:v1");
	release();
});

test("query cancellation resets an initial fetch back to the initial state", async () => {
	const runtime = makeRuntime();
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		queryFn: (_id, { signal }) =>
			Effect.never.pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						expect(signal.aborted).toBe(true);
					}),
				),
			),
	});

	const registry = AtomRegistry.make();
	const atom = userQuery("1");
	const release = registry.mount(atom);
	await Effect.runPromise(Effect.sleep("0 millis"));

	await Effect.runPromise(userQuery.cancel("1"));
	await Effect.runPromise(Effect.sleep("0 millis"));

	const current = registry.get(atom);
	expect(current.pipe(AsyncResult.isInitial)).toBe(true);
	expect(current.waiting).toBe(false);
	release();
});
