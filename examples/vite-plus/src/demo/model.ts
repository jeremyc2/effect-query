import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as ServiceMap from "effect/ServiceMap";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
	createQueryAtom,
	createQueryAtomFactory,
	makeRuntime,
	mutation,
} from "../../../../src/index.ts";

export type TaskStatus = "planned" | "active" | "done";
export type TaskFilter = "all" | TaskStatus;

export interface TaskComment {
	readonly id: string;
	readonly author: string;
	readonly body: string;
	readonly createdAt: string;
}

export interface Task {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly status: TaskStatus;
	readonly assignee: string;
	readonly updatedAt: string;
	readonly comments: ReadonlyArray<TaskComment>;
}

export interface Dashboard {
	readonly totalTasks: number;
	readonly activeTasks: number;
	readonly doneTasks: number;
	readonly recentTasks: ReadonlyArray<Task>;
}

export interface CreateTaskInput {
	readonly title: string;
	readonly description: string;
	readonly status: Exclude<TaskStatus, "done">;
}

export interface AddCommentInput {
	readonly taskId: string;
	readonly body: string;
}

class TaskMissingError extends Schema.TaggedErrorClass<TaskMissingError>()(
	"TaskMissingError",
	{
		taskId: Schema.String,
	},
) {}

interface DemoStore {
	readonly nextTaskId: number;
	readonly nextCommentId: number;
	readonly tasks: ReadonlyArray<Task>;
}

const makeTask = ({
	id,
	title,
	description,
	status,
	assignee,
	updatedAt,
	comments = [],
}: {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	assignee: string;
	updatedAt: string;
	comments: ReadonlyArray<TaskComment>;
}) => ({
	id,
	title,
	description,
	status,
	assignee,
	updatedAt,
	comments,
});

const initialStore: DemoStore = {
	nextTaskId: 4,
	nextCommentId: 3,
	tasks: [
		makeTask({
			id: "task-1",
			title: "Ship the query atom factory docs page",
			description:
				"Document how list and detail query atom factories share reactivity keys.",
			status: "active",
			assignee: "Ada",
			updatedAt: "2026-04-03T16:00:00.000Z",
			comments: [
				{
					id: "comment-1",
					author: "Ada",
					body: "This page should explain invalidation in plain language.",
					createdAt: "2026-04-03T12:20:00.000Z",
				},
			],
		}),
		makeTask({
			id: "task-2",
			title: "Tighten mutation examples",
			description:
				"Show a mutation that invalidates list and detail query atoms together.",
			status: "planned",
			assignee: "Grace",
			updatedAt: "2026-04-03T13:15:00.000Z",
			comments: [],
		}),
		makeTask({
			id: "task-3",
			title: "Add router prefetch polish",
			description:
				"Warm the detail page before navigation so the query atom is already alive.",
			status: "done",
			assignee: "Linus",
			updatedAt: "2026-04-03T09:30:00.000Z",
			comments: [
				{
					id: "comment-3",
					author: "Linus",
					body: "The prefetch feels good when it is tied to a user hover.",
					createdAt: "2026-04-03T09:40:00.000Z",
				},
			],
		}),
	],
};

const sortTasks = (tasks: ReadonlyArray<Task>) =>
	[...tasks].sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);

const matchesFilter = (filter: TaskFilter, task: Task): boolean =>
	filter === "all" ? true : task.status === filter;

const nextTaskStatus = (status: TaskStatus): TaskStatus => {
	switch (status) {
		case "planned":
			return "active";
		case "active":
			return "done";
		case "done":
			return "active";
	}
};

const now = () => new Date().toISOString();

const withLatency = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.flatMap(Effect.sleep("120 millis"), () => effect);

export class DemoApi extends ServiceMap.Service<
	DemoApi,
	{
		readonly getDashboard: Effect.Effect<Dashboard>;
		readonly getTasks: (
			filter: TaskFilter,
		) => Effect.Effect<ReadonlyArray<Task>>;
		readonly getTask: (taskId: string) => Effect.Effect<Task, TaskMissingError>;
		readonly createTask: (input: CreateTaskInput) => Effect.Effect<Task>;
		readonly advanceTask: (
			taskId: string,
		) => Effect.Effect<Task, TaskMissingError>;
		readonly addComment: (
			input: AddCommentInput,
		) => Effect.Effect<Task, TaskMissingError>;
	}
>()("examples/vite-plus/DemoApi") {}

export const DemoApiLive = Layer.effect(
	DemoApi,
	Effect.gen(function* () {
		const store = yield* Ref.make(initialStore);

		const getTaskOrFail = Effect.fn(function* (taskId: string) {
			const state = yield* Ref.get(store);
			const task = state.tasks.find((candidate) => candidate.id === taskId);
			if (task === undefined) {
				return yield* Effect.fail(new TaskMissingError({ taskId }));
			}
			return task;
		});

		return {
			getDashboard: withLatency(
				Effect.fn(function* () {
					const state = yield* Ref.get(store);
					const sorted = sortTasks(state.tasks);
					return {
						totalTasks: sorted.length,
						activeTasks: sorted.filter((task) => task.status === "active")
							.length,
						doneTasks: sorted.filter((task) => task.status === "done").length,
						recentTasks: sorted.slice(0, 3),
					} satisfies Dashboard;
				})(),
			),
			getTasks: Effect.fn(function* (filter: TaskFilter) {
				return yield* withLatency(
					Effect.gen(function* () {
						const state = yield* Ref.get(store);
						return sortTasks(
							state.tasks.filter((task) => matchesFilter(filter, task)),
						);
					}),
				);
			}),
			getTask: Effect.fn(function* (taskId: string) {
				return yield* withLatency(getTaskOrFail(taskId));
			}),
			createTask: Effect.fn(function* (input: CreateTaskInput) {
				return yield* withLatency(
					Effect.gen(function* () {
						const state = yield* Ref.get(store);
						const createdAt = now();
						const task = makeTask({
							id: `task-${state.nextTaskId}`,
							title: input.title.trim(),
							description: input.description.trim(),
							status: input.status,
							assignee: "You",
							updatedAt: createdAt,
							comments: [],
						});
						yield* Ref.set(store, {
							...state,
							nextTaskId: state.nextTaskId + 1,
							tasks: [task, ...state.tasks],
						});
						return task;
					}),
				);
			}),
			advanceTask: Effect.fn(function* (taskId: string) {
				return yield* withLatency(
					Effect.gen(function* () {
						const state = yield* Ref.get(store);
						const currentTask = state.tasks.find((task) => task.id === taskId);
						if (currentTask === undefined) {
							return yield* Effect.fail(new TaskMissingError({ taskId }));
						}

						const updatedTask: Task = {
							...currentTask,
							status: nextTaskStatus(currentTask.status),
							updatedAt: now(),
						};

						yield* Ref.set(store, {
							...state,
							tasks: state.tasks.map((task) =>
								task.id === taskId ? updatedTask : task,
							),
						});

						return updatedTask;
					}),
				);
			}),
			addComment: Effect.fn(function* (input: AddCommentInput) {
				return yield* withLatency(
					Effect.gen(function* () {
						const state = yield* Ref.get(store);
						const currentTask = state.tasks.find(
							(task) => task.id === input.taskId,
						);
						if (currentTask === undefined) {
							return yield* Effect.fail(
								new TaskMissingError({ taskId: input.taskId }),
							);
						}

						const updatedTask: Task = {
							...currentTask,
							updatedAt: now(),
							comments: [
								...currentTask.comments,
								{
									id: `comment-${state.nextCommentId}`,
									author: "You",
									body: input.body.trim(),
									createdAt: now(),
								},
							],
						};

						yield* Ref.set(store, {
							...state,
							nextCommentId: state.nextCommentId + 1,
							tasks: state.tasks.map((task) =>
								task.id === input.taskId ? updatedTask : task,
							),
						});

						return updatedTask;
					}),
				);
			}),
		};
	}),
);

export const createDemoModel = () => {
	const queryRuntime = makeRuntime(DemoApiLive);

	const taskFilterAtom = Atom.make<TaskFilter>("all");
	const taskComposerAtom = Atom.make<CreateTaskInput>({
		title: "Pair Effect Atom with a query atom factory",
		description:
			"Keep form state in an atom and let the mutation invalidate the matching query atoms.",
		status: "planned",
	});
	const canCreateTaskAtom = Atom.make((get) => {
		const draft = get(taskComposerAtom);
		return (
			draft.title.trim().length >= 4 && draft.description.trim().length >= 12
		);
	});
	const commentDraftAtomFactory = Atom.family((taskId: string) =>
		Atom.make(`This task ${taskId} is a good place to show a mutation.`),
	);

	const dashboardAtom = createQueryAtom({
		runtime: queryRuntime,
		key: ["dashboard"],
		reactivityKeys: () => ({
			tasks: ["all"],
		}),
		query: DemoApi.use((api) => api.getDashboard),
	});

	const taskListAtomFactory = createQueryAtomFactory({
		runtime: queryRuntime,
		key: (filter: TaskFilter) => ["tasks", filter],
		reactivityKeys: () => ({
			tasks: ["all"],
		}),
		query: (filter: TaskFilter) => DemoApi.use((api) => api.getTasks(filter)),
	});

	const taskDetailAtomFactory = createQueryAtomFactory({
		runtime: queryRuntime,
		key: (taskId: string) => ["task", taskId],
		reactivityKeys: (taskId: string) => ({
			task: [taskId],
		}),
		query: (taskId: string) => DemoApi.use((api) => api.getTask(taskId)),
	});

	const createTaskMutation = mutation({
		runtime: queryRuntime,
		run: (input: CreateTaskInput) =>
			DemoApi.use((api) => api.createTask(input)),
		invalidate: (_input: CreateTaskInput, task: Task) => ({
			tasks: ["all"],
			task: [task.id],
		}),
	});

	const advanceTaskMutation = mutation({
		runtime: queryRuntime,
		run: (taskId: string) => DemoApi.use((api) => api.advanceTask(taskId)),
		invalidate: (taskId: string) => ({
			tasks: ["all"],
			task: [taskId],
		}),
	});

	const addCommentMutation = mutation({
		runtime: queryRuntime,
		run: (input: AddCommentInput) =>
			DemoApi.use((api) => api.addComment(input)),
		invalidate: (input: AddCommentInput) => ({
			tasks: ["all"],
			task: [input.taskId],
		}),
	});

	return {
		queryRuntime,
		taskFilterAtom,
		taskComposerAtom,
		canCreateTaskAtom,
		commentDraftAtomFactory,
		dashboardAtom,
		taskListAtomFactory,
		taskDetailAtomFactory,
		createTaskMutation,
		advanceTaskMutation,
		addCommentMutation,
	};
};

export type DemoModel = ReturnType<typeof createDemoModel>;

export const taskFilters: ReadonlyArray<TaskFilter> = [
	"all",
	"planned",
	"active",
	"done",
];

export const taskStatusLabel = (status: TaskStatus) => {
	switch (status) {
		case "planned":
			return "Planned";
		case "active":
			return "Active";
		case "done":
			return "Done";
	}
};

export const filterLabel = (filter: TaskFilter) =>
	filter === "all" ? "All tasks" : taskStatusLabel(filter);

export const optimisticAdvance = (task: Task): Task => ({
	...task,
	status: nextTaskStatus(task.status),
	updatedAt: now(),
});

export const appendOptimisticComment = (task: Task, body: string): Task => ({
	...task,
	updatedAt: now(),
	comments: [
		...task.comments,
		{
			id: `optimistic-${task.comments.length + 1}`,
			author: "You",
			body: body.trim(),
			createdAt: now(),
		},
	],
});

export const initialTaskComposer = (): CreateTaskInput => ({
	title: "",
	description: "",
	status: "planned",
});

export const getOptionOrElse = <A>(option: Option.Option<A>, orElse: () => A) =>
	Option.match(option, {
		onNone: orElse,
		onSome: (value) => value,
	});
