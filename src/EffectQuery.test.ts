import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	dehydrate,
	family,
	hydrate,
	makeRuntime,
	mutation,
	onWindowFocus,
	provideRuntime,
} from "./EffectQuery.ts";
import { assertSome, assertSuccess } from "./testing-utils.ts";

describe("effect-query", () => {
	test("deduplicates concurrent ensure calls", async () => {
		const runtime = makeRuntime();
		let calls = 0;
		const loadUser = Effect.fnUntraced(function* (id: string) {
			calls += 1;
			yield* Effect.sleep("10 millis");
			return `${id}:${calls}`;
		});

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			policy: {
				staleTime: "1 minute",
			},
			query: loadUser,
		});

		const [first, second] = await Effect.runPromise(
			Effect.all([userQuery.ensure("1"), userQuery.ensure("1")]),
		);

		expect(first).toBe("1:1");
		expect(second).toBe("1:1");
		expect(calls).toBe(1);
	});

	test("keeps previous success while a query refresh is waiting", async () => {
		const runtime = makeRuntime();
		let version = "v1";
		const loadUser = Effect.fnUntraced(function* (id: string) {
			yield* Effect.sleep("10 millis");
			return `${id}:${version}`;
		});

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			query: loadUser,
		});

		const registry = AtomRegistry.make();
		const atom = userQuery("1");
		const releaseQuery = registry.mount(atom);

		await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		);

		version = "v2";
		registry.refresh(atom);
		await Effect.runPromise(Effect.sleep("0 millis"));

		const duringRefetch = registry.get(atom);
		assertSuccess(duringRefetch);
		expect(duringRefetch.waiting).toBe(true);
		expect(duringRefetch.value).toBe("1:v1");

		const nextValue = await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		);
		expect(nextValue).toBe("1:v2");
		releaseQuery();
	});

	test("mutations invalidate only their declared reactivity keys", async () => {
		const runtime = makeRuntime();
		let userVersion = "v1";
		let projectVersion = "v1";

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			policy: {
				staleTime: "1 hour",
			},
			reactivityKeys: (id: string) => ({
				user: [id],
			}),
			query: (id: string) => Effect.succeed(`${id}:${userVersion}`),
		});

		const projectQuery = family({
			runtime,
			key: (id: string) => ["project", id],
			policy: {
				staleTime: "1 hour",
			},
			reactivityKeys: (id: string) => ({
				project: [id],
			}),
			query: (id: string) => Effect.succeed(`${id}:${projectVersion}`),
		});

		const invalidateUser = mutation({
			runtime,
			run: (id: string) => Effect.succeed(id),
			invalidate: (id: string) => ({
				user: [id],
			}),
		});

		const registry = AtomRegistry.make();
		const userAtom = userQuery("1");
		const projectAtom = projectQuery("1");
		const releaseUser = registry.mount(userAtom);
		const releaseProject = registry.mount(projectAtom);
		const releaseMutation = registry.mount(invalidateUser);

		await Effect.runPromise(
			AtomRegistry.getResult(registry, userAtom, { suspendOnWaiting: true }),
		);
		await Effect.runPromise(
			AtomRegistry.getResult(registry, projectAtom, {
				suspendOnWaiting: true,
			}),
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

	test("setData and peek share the same runtime-backed cache as query atoms", async () => {
		const runtime = makeRuntime();
		let calls = 0;

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			policy: {
				staleTime: "1 hour",
			},
			query: (id: string) =>
				Effect.sync(() => {
					calls += 1;
					return `${id}:fetched`;
				}),
		});

		await Effect.runPromise(userQuery.setData("1", "1:seeded"));
		const peeked = await Effect.runPromise(userQuery.peek("1"));
		assertSome(peeked);

		const registry = AtomRegistry.make();
		const atom = userQuery("1");
		const release = registry.mount(atom);

		const current = registry.get(atom);
		assertSuccess(current);
		expect(current.value).toBe("1:seeded");
		expect(calls).toBe(0);
		release();
	});

	test("hydrates successful query snapshots into a fresh registry", async () => {
		const runtime = makeRuntime();

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			policy: {
				staleTime: "1 hour",
			},
			query: (id: string) => Effect.succeed(`${id}:hydrated`),
		});

		const sourceRegistry = AtomRegistry.make();
		const atom = userQuery("1");
		const releaseSource = sourceRegistry.mount(atom);

		await Effect.runPromise(
			AtomRegistry.getResult(sourceRegistry, atom, {
				suspendOnWaiting: true,
			}),
		);
		const dehydrated = dehydrate(sourceRegistry);

		const targetRegistry = AtomRegistry.make();
		hydrate(targetRegistry, dehydrated);

		const hydrated = targetRegistry.get(atom);
		assertSuccess(hydrated);
		expect(hydrated.value).toBe("1:hydrated");
		releaseSource();
	});

	test("refetches stale active queries on window focus", async () => {
		const runtime = makeRuntime();
		let version = "v1";
		const loadUser = Effect.fnUntraced(function* (id: string) {
			yield* Effect.sleep("5 millis");
			return `${id}:${version}`;
		});

		const userQuery = family({
			runtime,
			key: (id: string) => ["user", id],
			policy: {
				staleTime: "0 millis",
				refetchOnWindowFocus: true,
			},
			query: loadUser,
		});

		const registry = AtomRegistry.make();
		const atom = userQuery("1");
		const release = registry.mount(atom);
		await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		);
		version = "v2";

		await Effect.runPromise(provideRuntime(runtime, onWindowFocus));
		const nextValue = await Effect.runPromise(
			AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
		);
		expect(nextValue).toBe("1:v2");
		release();
	});
});
