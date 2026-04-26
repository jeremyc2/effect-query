import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import {
	createMutationAtom,
	createQueryAtomFactory,
	makeRuntime,
} from "../EffectQuery.ts";
import {
	assertSuccess,
	waitForMutationSuccess,
	waitForQuerySuccess,
} from "../testing-utils.ts";

interface Comment {
	readonly id: string;
	readonly body: string;
}

interface Task {
	readonly id: string;
	readonly comments: ReadonlyArray<Comment>;
}

test("optimistic updates stay visible until the invalidation refetch resolves", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime();
			let nextCommentId = 2;
			let task: Task = {
				id: "task-1",
				comments: [{ id: "comment-1", body: "Original comment" }],
			};

			const taskQuery = createQueryAtomFactory({
				runtime,
				queryKey: (taskId: string) => ["task", taskId],
				staleTime: "1 hour",
				reactivityKeys: (taskId: string) => ({ task: [taskId] }),
				queryFn: Effect.fnUntraced(function* (taskId: string) {
					yield* Effect.sleep("20 millis");
					return task.id === taskId ? task : { id: taskId, comments: [] };
				}),
			});
			const addComment = createMutationAtom({
				runtime,
				mutationFn: Effect.fnUntraced(function* (input: {
					readonly taskId: string;
					readonly body: string;
				}) {
					yield* Effect.sleep("10 millis");
					task = {
						...task,
						comments: [
							...task.comments,
							{ id: `comment-${nextCommentId}`, body: input.body },
						],
					};
					nextCommentId += 1;
					return task;
				}),
				invalidate: (input: { readonly taskId: string }) => ({
					task: [input.taskId],
				}),
			});

			const registry = AtomRegistry.make();
			const atom = taskQuery("task-1");
			const releaseQuery = registry.mount(atom);
			const releaseMutation = registry.mount(addComment);
			yield* waitForQuerySuccess(registry, atom);

			yield* taskQuery.setData("task-1", (current) => {
				const base = Option.getOrElse(current, () => task);
				return {
					...base,
					comments: [
						...base.comments,
						{ id: "optimistic-comment", body: "Optimistic comment" },
					],
				};
			});

			registry.set(addComment, {
				taskId: "task-1",
				body: "Optimistic comment",
			});
			yield* waitForMutationSuccess(registry, addComment);
			yield* Effect.sleep("0 millis");

			const duringRefetch = registry.get(atom);
			assertSuccess(duringRefetch);
			expect(duringRefetch.isFetching).toBe(true);
			expect(duringRefetch.data.comments.at(-1)).toEqual({
				id: "optimistic-comment",
				body: "Optimistic comment",
			});

			const resolved = yield* waitForQuerySuccess(registry, atom);
			expect(resolved.data.comments.at(-1)).toEqual({
				id: "comment-2",
				body: "Optimistic comment",
			});

			releaseMutation();
			releaseQuery();
		}),
	));
