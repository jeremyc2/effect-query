import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createQueryAtomFactory } from "../EffectQuery.ts";

test("render optimizations keep unrelated query subscribers quiet", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			let userVersion = "v1";
			const projectVersion = "v1";

			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				queryFn: (id: string) => Effect.succeed(`${id}:${userVersion}`),
			});
			const projectQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["project", id],
				queryFn: (id: string) => Effect.succeed(`${id}:${projectVersion}`),
			});

			const registry = AtomRegistry.make();
			const userAtom = userQuery("1");
			const projectAtom = projectQuery("1");
			const releaseUser = registry.mount(userAtom);
			const releaseProject = registry.mount(projectAtom);
			yield* Effect.all([userQuery.ensure("1"), projectQuery.ensure("1")]);

			let userNotifications = 0;
			let projectNotifications = 0;
			const cancelUser = registry.subscribe(userAtom, () => {
				userNotifications += 1;
			});
			const cancelProject = registry.subscribe(projectAtom, () => {
				projectNotifications += 1;
			});

			userNotifications = 0;
			projectNotifications = 0;
			userVersion = "v2";
			yield* userQuery.refresh("1");
			yield* Effect.sleep("0 millis");

			expect(userNotifications).toBeGreaterThan(0);
			expect(projectNotifications).toBe(0);

			cancelProject();
			cancelUser();
			releaseProject();
			releaseUser();
		}),
	));
