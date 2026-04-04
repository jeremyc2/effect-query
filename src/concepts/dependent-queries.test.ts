import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";

test("dependent queries can defer fetching with enabled", async () => {
	let calls = 0;
	const searchQuery = createQueryAtomFactory({
		queryKey: (filter: string) => ["search", filter],
		enabled: (filter: string) => filter.length > 0,
		queryFn: (filter: string) =>
			Effect.sync(() => {
				calls += 1;
				return `results:${filter}`;
			}),
	});

	const registry = AtomRegistry.make();
	const disabledAtom = searchQuery("");
	const enabledAtom = searchQuery("openai");
	const releaseDisabled = registry.mount(disabledAtom);

	await Effect.runPromise(Effect.sleep("0 millis"));
	expect(calls).toBe(0);

	const releaseEnabled = registry.mount(enabledAtom);
	expect(
		await Effect.runPromise(
			AtomRegistry.getResult(registry, enabledAtom, {
				suspendOnWaiting: true,
			}),
		),
	).toBe("results:openai");
	expect(calls).toBe(1);
	releaseEnabled();
	releaseDisabled();
});
