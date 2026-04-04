import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createMutationAtom,
	createQueryAtomFactory,
	makeRuntime,
} from "../EffectQuery.ts";
import { assertSuccess } from "../testing-utils.ts";

test("invalidation from mutations only refreshes declared reactivity keys", async () => {
	const runtime = makeRuntime();
	let userVersion = "v1";
	let projectVersion = "v1";

	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		staleTime: "1 hour",
		reactivityKeys: (id: string) => ({ user: [id] }),
		queryFn: (id: string) => Effect.succeed(`${id}:${userVersion}`),
	});
	const projectQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["project", id],
		staleTime: "1 hour",
		reactivityKeys: (id: string) => ({ project: [id] }),
		queryFn: (id: string) => Effect.succeed(`${id}:${projectVersion}`),
	});
	const invalidateUser = createMutationAtom({
		runtime,
		mutationFn: (id: string) => Effect.succeed(id),
		invalidate: (id: string) => ({ user: [id] }),
	});

	const registry = AtomRegistry.make();
	const userAtom = userQuery("1");
	const projectAtom = projectQuery("1");
	const releaseUser = registry.mount(userAtom);
	const releaseProject = registry.mount(projectAtom);
	const releaseMutation = registry.mount(invalidateUser);

	await Effect.runPromise(
		Effect.all([
			AtomRegistry.getResult(registry, userAtom, { suspendOnWaiting: true }),
			AtomRegistry.getResult(registry, projectAtom, {
				suspendOnWaiting: true,
			}),
		]),
	);

	userVersion = "v2";
	projectVersion = "v2";
	registry.set(invalidateUser, "1");
	await Effect.runPromise(
		AtomRegistry.getResult(registry, invalidateUser, {
			suspendOnWaiting: true,
		}),
	);
	await Effect.runPromise(Effect.sleep("0 millis"));

	const nextUser = registry.get(userAtom);
	const nextProject = registry.get(projectAtom);
	assertSuccess(nextUser);
	assertSuccess(nextProject);
	expect(nextUser.value).toBe("1:v2");
	expect(nextProject.value).toBe("1:v1");

	releaseMutation();
	releaseProject();
	releaseUser();
});
