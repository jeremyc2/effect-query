import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createQueryAtomFactory,
	makeRuntime,
	provideRuntime,
} from "../EffectQuery.ts";
import { QueryStore } from "../effect-query/store.ts";
import { assertSuccess } from "../testing-utils.ts";

test("filters can invalidate a grouped set of related query atoms", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let taskOneVersion = "v1";
			let taskTwoVersion = "v1";

			const taskQuery = createQueryAtomFactory({
				runtime,
				queryKey: (taskId: string) => ["task", taskId],
				staleTime: "1 hour",
				reactivityKeys: (taskId: string) => ({ task: [taskId] }),
				queryFn: (taskId: string) =>
					Effect.succeed(taskId === "1" ? taskOneVersion : taskTwoVersion),
			});

			const registry = AtomRegistry.make();
			const taskOneAtom = taskQuery("1");
			const taskTwoAtom = taskQuery("2");
			const releaseOne = registry.mount(taskOneAtom);
			const releaseTwo = registry.mount(taskTwoAtom);
			yield* Effect.all([taskQuery.ensure("1"), taskQuery.ensure("2")]);

			taskOneVersion = "v2";
			taskTwoVersion = "v2";
			yield* provideRuntime(
				runtime,
				QueryStore.use((store) => store.invalidate({ task: ["1"] })),
			);
			yield* Effect.sleep("0 millis");

			const first = registry.get(taskOneAtom);
			const second = registry.get(taskTwoAtom);
			assertSuccess(first);
			assertSuccess(second);
			expect(first.data).toBe("v2");
			expect(second.data).toBe("v2");

			releaseTwo();
			releaseOne();
		}),
	));
