import { getRouteApi, Link, Outlet } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { ReactNode } from "react";
import {
	getFailureCause,
	getSuccess,
	isFailure,
	isInitial,
	isSuccess,
	isWaiting,
} from "../../../index.ts";
import { useDemo } from "./demo/context.tsx";
import {
	useAtomSet,
	useAtomUpdate,
	useAtomValue,
	useMutation,
} from "./demo/hooks.ts";
import {
	appendOptimisticComment,
	type CreateTaskInput,
	type Dashboard,
	filterLabel,
	getOptionOrElse,
	initialTaskComposer,
	optimisticAdvance,
	type Task,
	taskFilters,
	taskStatusLabel,
} from "./demo/model.ts";

const toDraftStatus = (value: string): CreateTaskInput["status"] =>
	value === "active" ? "active" : "planned";

const shellCardClassName =
	"border border-white/8 bg-[rgba(24,19,16,0.78)] shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-[22px]";

const panelClassName = `${shellCardClassName} flex flex-col gap-4 rounded-[1.5rem] p-5`;

const ghostButtonClassName =
	"cursor-pointer rounded-full border border-white/12 bg-white/4 px-4 py-3 text-sm text-inherit transition hover:-translate-y-px hover:bg-white/7";

const eyebrowClassName =
	"mb-2 text-[0.76rem] font-bold uppercase tracking-[0.16em] text-[#f6b15a]";

const fieldClassName = "flex flex-col gap-2";

const inputClassName =
	"rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-inherit outline-none transition focus:border-[#f6b15a]/60";

const taskDetailRouteApi = getRouteApi("/tasks/$taskId");

export function RootLayout() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(242,155,57,0.28),transparent_28%),linear-gradient(180deg,#171311_0%,#231b16_45%,#140f0c_100%)] text-[#f7f5ee] font-['IBM_Plex_Sans','Avenir_Next',sans-serif]">
			<div className="mx-auto grid min-h-screen max-w-368 gap-6 p-6 lg:grid-cols-[minmax(16rem,21rem)_minmax(0,1fr)]">
				<aside
					className={`${shellCardClassName} top-6 flex h-fit flex-col gap-6 rounded-[1.6rem] p-6 lg:sticky lg:h-[calc(100vh-3rem)]`}
				>
					<div>
						<p className={eyebrowClassName}>Example app</p>
						<h1 className="m-0 text-4xl font-semibold tracking-tight">
							Vite Plus + Effect Query
						</h1>
						<p className="mt-4 text-base text-white/78">
							A tiny task tracker that keeps local UI state in atoms and remote
							state in query families.
						</p>
					</div>

					<nav className="flex flex-col gap-3">
						<Link
							to="/"
							activeProps={{
								className:
									"rounded-full border border-[#f6b15a]/45 bg-[#f6b15a]/14 px-4 py-3 transition",
							}}
							className="rounded-full border border-white/8 px-4 py-3 transition hover:-translate-y-px hover:border-[#f6b15a]/45 hover:bg-[#f6b15a]/14"
						>
							Overview
						</Link>
						<Link
							to="/tasks"
							activeProps={{
								className:
									"rounded-full border border-[#f6b15a]/45 bg-[#f6b15a]/14 px-4 py-3 transition",
							}}
							className="rounded-full border border-white/8 px-4 py-3 transition hover:-translate-y-px hover:border-[#f6b15a]/45 hover:bg-[#f6b15a]/14"
						>
							Tasks
						</Link>
					</nav>

					<div className="rounded-[1.2rem] bg-white/4 p-4">
						<h2 className="m-0 text-lg font-semibold">What this demos</h2>
						<ul className="mt-4 list-disc space-y-2 pl-5 text-white/78">
							<li>Query families for dashboard, list, and detail pages</li>
							<li>Mutations with invalidation across shared reactivity keys</li>
							<li>
								Effect Atom state for filters, drafts, and derived UI state
							</li>
							<li>Prefetch and manual cache updates with `setData`</li>
						</ul>
					</div>
				</aside>

				<main className="min-w-0">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

export function OverviewPage() {
	const {
		model: { dashboardQuery, taskDetailQuery },
	} = useDemo();
	const dashboard = useAtomValue(dashboardQuery);

	return (
		<section className="flex flex-col gap-6">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<p className={eyebrowClassName}>Overview</p>
					<h2 className="m-0 text-3xl font-semibold tracking-tight">
						One query atom per screen, without extra cruft
					</h2>
				</div>
				<button
					className={ghostButtonClassName}
					onClick={() => {
						void Effect.runPromise(dashboardQuery.refresh());
					}}
					type="button"
				>
					Refresh dashboard
				</button>
			</header>

			<QueryState<Dashboard> result={dashboard}>
				{(value) => (
					<>
						<section className="grid gap-4 md:grid-cols-3">
							<article className="rounded-[1.2rem] bg-white/4 p-5">
								<span className="text-sm text-white/72">Total tasks</span>
								<strong className="mt-1 block text-4xl font-semibold">
									{value.totalTasks}
								</strong>
							</article>
							<article className="rounded-[1.2rem] bg-white/4 p-5">
								<span className="text-sm text-white/72">Active tasks</span>
								<strong className="mt-1 block text-4xl font-semibold">
									{value.activeTasks}
								</strong>
							</article>
							<article className="rounded-[1.2rem] bg-white/4 p-5">
								<span className="text-sm text-white/72">Done tasks</span>
								<strong className="mt-1 block text-4xl font-semibold">
									{value.doneTasks}
								</strong>
							</article>
						</section>

						<section className={panelClassName}>
							<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
								<div>
									<p className={eyebrowClassName}>Recent work</p>
									<h3 className="m-0 text-2xl font-semibold tracking-tight">
										Prefetch the detail page before navigating
									</h3>
								</div>
								<Link to="/tasks" className={ghostButtonClassName}>
									Open all tasks
								</Link>
							</div>

							<div className="flex flex-col gap-3">
								{value.recentTasks.map((task) => (
									<Link
										key={task.id}
										to="/tasks/$taskId"
										params={{ taskId: task.id }}
										className="rounded-[1.2rem] bg-white/4 p-4 transition hover:-translate-y-px hover:bg-white/6"
										onMouseEnter={() => {
											void Effect.runPromise(taskDetailQuery.prefetch(task.id));
										}}
									>
										<div className="flex items-center justify-between gap-4">
											<h4 className="m-0 text-lg font-semibold">
												{task.title}
											</h4>
											<StatusPill status={task.status} />
										</div>
										<p className="mt-3 text-white/78">{task.description}</p>
									</Link>
								))}
							</div>
						</section>
					</>
				)}
			</QueryState>
		</section>
	);
}

export function TasksPage() {
	const {
		model: {
			taskComposerAtom,
			taskFilterAtom,
			canCreateTaskAtom,
			taskListQuery,
			taskDetailQuery,
			createTaskMutation,
			advanceTaskMutation,
		},
	} = useDemo();
	const selectedFilter = useAtomValue(taskFilterAtom);
	const setFilter = useAtomSet(taskFilterAtom);
	const draft = useAtomValue(taskComposerAtom);
	const updateDraft = useAtomUpdate(taskComposerAtom);
	const canCreateTask = useAtomValue(canCreateTaskAtom);
	const tasks = useAtomValue(taskListQuery(selectedFilter));
	const createTask = useMutation(createTaskMutation);
	const advanceTask = useMutation(advanceTaskMutation);

	return (
		<section className="flex flex-col gap-6">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<p className={eyebrowClassName}>Tasks</p>
					<h2 className="m-0 text-3xl font-semibold tracking-tight">
						Use an atom to pick the active query family member
					</h2>
				</div>
				<button
					className={ghostButtonClassName}
					onClick={() => {
						void Effect.runPromise(taskListQuery.refresh(selectedFilter));
					}}
					type="button"
				>
					Refresh list
				</button>
			</header>

			<section className="grid gap-4 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
				<form
					className={panelClassName}
					onSubmit={(event) => {
						event.preventDefault();
						if (!canCreateTask) {
							return;
						}
						createTask.run(draft);
						updateDraft(() => initialTaskComposer());
					}}
				>
					<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
						<div>
							<p className={eyebrowClassName}>Mutation</p>
							<h3 className="m-0 text-2xl font-semibold tracking-tight">
								Create a task
							</h3>
						</div>
						<MutationState label="Create task" result={createTask.result} />
					</div>

					<label className={fieldClassName}>
						<span className="text-sm text-white/72">Title</span>
						<input
							className={inputClassName}
							value={draft.title}
							onChange={(event) => {
								updateDraft((current) => ({
									...current,
									title: event.target.value,
								}));
							}}
						/>
					</label>

					<label className={fieldClassName}>
						<span className="text-sm text-white/72">Description</span>
						<textarea
							className={`${inputClassName} min-h-28 resize-y`}
							rows={4}
							value={draft.description}
							onChange={(event) => {
								updateDraft((current) => ({
									...current,
									description: event.target.value,
								}));
							}}
						/>
					</label>

					<label className={fieldClassName}>
						<span className="text-sm text-white/72">Starting status</span>
						<select
							className={inputClassName}
							value={draft.status}
							onChange={(event) => {
								updateDraft((current) => ({
									...current,
									status: toDraftStatus(event.target.value),
								}));
							}}
						>
							<option value="planned">Planned</option>
							<option value="active">Active</option>
						</select>
					</label>

					<button
						className="cursor-pointer rounded-full bg-[linear-gradient(135deg,#f6b15a_0%,#ff7d4d_100%)] px-4 py-3 font-semibold text-[#1d140f] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
						disabled={!canCreateTask}
						type="submit"
					>
						Create task
					</button>
				</form>

				<section className={panelClassName}>
					<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
						<div>
							<p className={eyebrowClassName}>Query family</p>
							<h3 className="m-0 text-2xl font-semibold tracking-tight">
								{filterLabel(selectedFilter)}
							</h3>
						</div>
						<MutationState label="Advance task" result={advanceTask.result} />
					</div>

					<div className="flex flex-wrap gap-2">
						{taskFilters.map((filter) => (
							<button
								key={filter}
								className={`cursor-pointer rounded-full border px-4 py-3 text-sm transition hover:-translate-y-px ${
									filter === selectedFilter
										? "border-[#f6b15a]/45 bg-[#f6b15a]/14"
										: "border-white/12 bg-white/4 hover:bg-white/7"
								}`}
								onClick={() => {
									setFilter(filter);
								}}
								type="button"
							>
								{filterLabel(filter)}
							</button>
						))}
					</div>

					<QueryState<ReadonlyArray<Task>> result={tasks}>
						{(value) => (
							<div className="flex flex-col gap-3">
								{value.map((task) => (
									<article
										className="rounded-[1.2rem] bg-white/4 p-4"
										key={task.id}
									>
										<div className="flex items-center justify-between gap-4">
											<Link
												to="/tasks/$taskId"
												params={{ taskId: task.id }}
												className="text-lg font-semibold transition hover:text-[#f6b15a]"
												onMouseEnter={() => {
													void Effect.runPromise(
														taskDetailQuery.prefetch(task.id),
													);
												}}
											>
												{task.title}
											</Link>
											<StatusPill status={task.status} />
										</div>
										<p className="mt-3 text-white/78">{task.description}</p>
										<div className="mt-4 flex items-center justify-between gap-4">
											<small className="text-white/72">{task.assignee}</small>
											<button
												className={ghostButtonClassName}
												onClick={() => {
													advanceTask.run(task.id);
												}}
												type="button"
											>
												Advance status
											</button>
										</div>
									</article>
								))}
							</div>
						)}
					</QueryState>
				</section>
			</section>
		</section>
	);
}

export function TaskDetailPage() {
	const { taskId } = taskDetailRouteApi.useParams();
	const {
		model: {
			taskDetailQuery,
			commentDraftFamily,
			addCommentMutation,
			advanceTaskMutation,
		},
	} = useDemo();
	const task = useAtomValue(taskDetailQuery(taskId));
	const commentDraftAtom = commentDraftFamily(taskId);
	const commentDraft = useAtomValue(commentDraftAtom);
	const setCommentDraft = useAtomSet(commentDraftAtom);
	const advanceTask = useMutation(advanceTaskMutation);
	const addComment = useMutation(addCommentMutation);

	const taskSuccess = getSuccess(task);
	const taskValue = Option.isSome(taskSuccess) ? taskSuccess.value : undefined;
	const applyOptimisticTask = Effect.fnUntraced(function* (
		update: (current: Task) => Task,
		run: Effect.Effect<unknown, unknown>,
		onSuccess?: Effect.Effect<void>,
	) {
		if (taskValue === undefined) {
			return;
		}

		const previousTask = taskValue;
		yield* taskDetailQuery.setData(taskId, (current) =>
			update(getOptionOrElse(current, () => previousTask)),
		);
		const exit = yield* Effect.exit(run);
		if (exit._tag === "Failure") {
			yield* taskDetailQuery.setData(taskId, previousTask);
			return;
		}
		if (onSuccess !== undefined) {
			yield* onSuccess;
		}
	});

	return (
		<section className="flex flex-col gap-6">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<p className={eyebrowClassName}>Detail</p>
					<h2 className="m-0 text-3xl font-semibold tracking-tight">
						Mutate first, then invalidate the matching query atoms
					</h2>
				</div>
				<button
					className={ghostButtonClassName}
					onClick={() => {
						void Effect.runPromise(taskDetailQuery.refresh(taskId));
					}}
					type="button"
				>
					Refresh detail
				</button>
			</header>

			<QueryState<Task> result={task}>
				{(value) => (
					<div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
						<section className={panelClassName}>
							<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
								<div>
									<p className={eyebrowClassName}>Query atom</p>
									<h3 className="m-0 text-2xl font-semibold tracking-tight">
										{value.title}
									</h3>
								</div>
								<StatusPill status={value.status} />
							</div>

							<p className="text-white/78">{value.description}</p>

							<dl className="grid gap-4 sm:grid-cols-2">
								<div>
									<dt className="text-sm text-white/72">Assignee</dt>
									<dd className="mt-1">{value.assignee}</dd>
								</div>
								<div>
									<dt className="text-sm text-white/72">Updated</dt>
									<dd className="mt-1">
										{new Date(value.updatedAt).toLocaleString()}
									</dd>
								</div>
							</dl>

							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<button
									className="cursor-pointer rounded-full bg-[linear-gradient(135deg,#f6b15a_0%,#ff7d4d_100%)] px-4 py-3 font-semibold text-[#1d140f] transition hover:-translate-y-px"
									onClick={() => {
										void Effect.runPromise(
											applyOptimisticTask(
												optimisticAdvance,
												advanceTask.runEffect(taskId),
											),
										);
									}}
									type="button"
								>
									Advance status
								</button>
								<MutationState
									label="Advance task"
									result={advanceTask.result}
								/>
							</div>
						</section>

						<section className={panelClassName}>
							<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
								<div>
									<p className={eyebrowClassName}>Mutation</p>
									<h3 className="m-0 text-2xl font-semibold tracking-tight">
										Add a comment
									</h3>
								</div>
								<MutationState label="Add comment" result={addComment.result} />
							</div>

							<form
								className="flex flex-col gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									const body = commentDraft.trim();
									if (body.length === 0 || taskValue === undefined) {
										return;
									}
									void Effect.runPromise(
										applyOptimisticTask(
											(current) => appendOptimisticComment(current, body),
											addComment.runEffect({ taskId, body }),
											Effect.sync(() => {
												setCommentDraft("");
											}),
										),
									);
								}}
							>
								<label className={fieldClassName}>
									<span className="text-sm text-white/72">Comment</span>
									<textarea
										className={`${inputClassName} min-h-28 resize-y`}
										rows={4}
										value={commentDraft}
										onChange={(event) => {
											setCommentDraft(event.target.value);
										}}
									/>
								</label>

								<button
									className="cursor-pointer rounded-full bg-[linear-gradient(135deg,#f6b15a_0%,#ff7d4d_100%)] px-4 py-3 font-semibold text-[#1d140f] transition hover:-translate-y-px"
									type="submit"
								>
									Add comment
								</button>
							</form>

							<div className="flex flex-col gap-3">
								{value.comments.map((comment) => (
									<article
										className="rounded-[1.2rem] bg-white/4 p-4"
										key={comment.id}
									>
										<div className="flex items-center justify-between gap-4">
											<strong>{comment.author}</strong>
											<small className="text-white/72">
												{new Date(comment.createdAt).toLocaleString()}
											</small>
										</div>
										<p className="mt-3 text-white/78">{comment.body}</p>
									</article>
								))}
							</div>
						</section>
					</div>
				)}
			</QueryState>
		</section>
	);
}

function QueryState<A>(props: {
	readonly result: import("effect/unstable/reactivity/AsyncResult").AsyncResult<
		A,
		unknown
	>;
	readonly children: (value: A) => ReactNode;
}) {
	const success = getSuccess(props.result);
	if (Option.isSome(success)) {
		return props.children(success.value);
	}

	if (isInitial(props.result) || isWaiting(props.result)) {
		return <div className={`${panelClassName} rounded-[1.4rem]`}>Loading…</div>;
	}

	if (isFailure(props.result)) {
		const failure = getFailureCause(props.result);
		return (
			<div
				className={`${panelClassName} rounded-[1.4rem] bg-[rgba(255,108,94,0.18)] text-[#ffc3bc]`}
			>
				{Option.isSome(failure)
					? Cause.pretty(failure.value)
					: "Request failed."}
			</div>
		);
	}

	return (
		<div className={`${panelClassName} rounded-[1.4rem]`}>No data yet.</div>
	);
}

function MutationState(props: {
	readonly label: string;
	readonly result: import("effect/unstable/reactivity/AsyncResult").AsyncResult<
		unknown,
		unknown
	>;
}) {
	if (isWaiting(props.result)) {
		return (
			<span className="rounded-full bg-white/8 px-3 py-1 text-xs">
				Saving {props.label.toLowerCase()}…
			</span>
		);
	}

	if (isFailure(props.result)) {
		return (
			<span className="rounded-full bg-[rgba(255,108,94,0.18)] px-3 py-1 text-xs text-[#ffc3bc]">
				Failed
			</span>
		);
	}

	if (isSuccess(props.result)) {
		return (
			<span className="rounded-full bg-[rgba(73,184,126,0.18)] px-3 py-1 text-xs text-[#8ce0b0]">
				Saved
			</span>
		);
	}

	return (
		<span className="rounded-full bg-white/8 px-3 py-1 text-xs">Idle</span>
	);
}

function StatusPill(props: { readonly status: "planned" | "active" | "done" }) {
	const colorClassName =
		props.status === "active"
			? "bg-[rgba(73,184,126,0.18)] text-[#8ce0b0]"
			: props.status === "done"
				? "bg-[rgba(93,138,255,0.18)] text-[#a8c1ff]"
				: "bg-white/8";

	return (
		<span className={`rounded-full px-3 py-1 text-xs ${colorClassName}`}>
			{taskStatusLabel(props.status)}
		</span>
	);
}
