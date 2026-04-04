import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as ServiceMap from "effect/ServiceMap";
import * as SubscriptionRef from "effect/SubscriptionRef";
import {
	applyDataUpdater,
	failureQueryResult,
	fromExitWithPrevious,
	getCurrentSuccess,
	hashQueryKey,
	initialQueryResult,
	isInterruptedCause,
	needsRefetchBase,
	resolveCompletedResult,
	successQueryResult,
	toReactivityHashSet,
	waitingFromPrevious,
} from "./core.ts";
import type {
	DataUpdater,
	EventReason,
	InternalQuery,
	QueryEntry,
	QueryEntryBase,
	QueryResult,
	ReactivityKeySet,
	TouchReason,
} from "./types.ts";

export class QueryStore extends ServiceMap.Service<
	QueryStore,
	{
		readonly observe: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<
			SubscriptionRef.SubscriptionRef<QueryResult<A, E>>,
			never,
			R | Scope.Scope
		>;
		readonly ensure: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<A, E, R>;
		readonly peek: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<Option.Option<QueryResult<A, E>>>;
		readonly prefetch: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<void, never, R>;
		readonly refresh: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<A, E, R>;
		readonly cancel: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<void>;
		readonly setData: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
			updater: DataUpdater<A>,
		) => Effect.Effect<A, never, R>;
		readonly invalidate: (keys: ReactivityKeySet) => Effect.Effect<void>;
		readonly onFocus: Effect.Effect<void>;
		readonly onOffline: Effect.Effect<void>;
		readonly onOnline: Effect.Effect<void>;
	}
>()("effect-query/effect-query/store/QueryStore") {}

export const QueryStoreLayer = Layer.effect(
	QueryStore,
	Effect.gen(function* () {
		const storeScope = yield* Effect.scope;
		const entries = new Set<QueryEntryBase>();
		let online = true;
		let onlineSignal = yield* Deferred.make<void>();
		yield* Deferred.succeed(onlineSignal, undefined);

		const waitForOnline = Effect.fnUntraced(function* () {
			if (online) {
				return;
			}
			yield* Deferred.await(onlineSignal);
		});

		const pruneExpired = Effect.fnUntraced(function* (now: number) {
			for (const entry of entries) {
				if (entry.activeCount > 0 || entry.lastInactiveAt === undefined) {
					continue;
				}

				const ttl = entry.policy.gcTimeMs;
				if (now - entry.lastInactiveAt < ttl) {
					continue;
				}

				const inFlight = entry.inFlight;
				const poller = entry.poller;
				const abortController = entry.abortController;
				entry.inFlight = undefined;
				entry.poller = undefined;
				entry.abortController = undefined;
				entry.remove();
				entries.delete(entry);
				abortController?.abort();
				if (inFlight !== undefined) {
					yield* Fiber.interrupt(inFlight);
				}
				if (poller !== undefined) {
					yield* Fiber.interrupt(poller);
				}
			}
		});

		const getOrCreate = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const hash = hashQueryKey(definition.key(arg));
			const existing = definition.entries.get(hash);
			if (existing !== undefined) {
				return existing;
			}

			const runQuery = yield* Effect.servicesWith(
				(services: ServiceMap.ServiceMap<R>) =>
					Effect.succeed((abortController: AbortController) => {
						const key = definition.key(arg);
						let fetchEffect: Effect.Effect<A, E, R> = definition.query(arg, {
							queryKey: key,
							signal: abortController.signal,
						});
						if (definition.policy.retry !== undefined) {
							fetchEffect = fetchEffect.pipe(
								Effect.retry(definition.policy.retry),
							);
						}
						return Effect.provideServices(fetchEffect, services).pipe(
							Effect.onInterrupt(() =>
								Effect.sync(() => abortController.abort()),
							),
						);
					}),
			);
			const initialData = definition.initialData(arg);
			const initialDataTimestamp = yield* Clock.currentTimeMillis;
			const resultRef = yield* SubscriptionRef.make<QueryResult<A, E>>(
				initialData === undefined
					? initialQueryResult()
					: successQueryResult(initialData, {
							timestamp:
								definition.initialDataUpdatedAt(arg) ?? initialDataTimestamp,
						}),
			);
			const lock = yield* Semaphore.make(1);
			const key = definition.key(arg);
			let entry!: QueryEntry<Arg, A, E, R>;
			const startFetch = Effect.fnUntraced(function* () {
				return yield* lock.withPermit(
					Effect.gen(function* () {
						if (entry.inFlight !== undefined) {
							return entry.inFlight;
						}

						const current = entry.current();
						yield* entry.setResult(
							Option.some(current).pipe(waitingFromPrevious),
						);
						if (entry.policy.networkMode === "online" && !online) {
							entry.paused = true;
							return undefined;
						}

						const abortController = new AbortController();
						const previous = current;
						const fiber = yield* entry.runQuery(abortController).pipe(
							Effect.onExit((exit) =>
								Effect.gen(function* () {
									entry.inFlight = undefined;
									entry.abortController = undefined;
									entry.invalidated = false;
									entry.paused = false;
									if (Exit.isFailure(exit) && isInterruptedCause(exit.cause)) {
										const next = previous.isPending
											? initialQueryResult()
											: previous;
										yield* entry.setResult(next);
										return;
									}
									yield* entry.setResult(
										fromExitWithPrevious(exit, Option.some(previous)),
									);
								}),
							),
							Effect.forkIn(storeScope),
						);

						entry.inFlight = fiber;
						entry.abortController = abortController;
						return fiber;
					}),
				);
			});
			entry = {
				definition,
				arg,
				hash,
				key,
				runQuery,
				resultRef,
				policy: definition.policy,
				reactivityHashes: toReactivityHashSet(definition.reactivityKeys(arg)),
				isEnabled: () => definition.enabled(arg),
				lock,
				snapshot: () => SubscriptionRef.getUnsafe(resultRef),
				current: () => SubscriptionRef.getUnsafe(resultRef),
				setResult: (result) => SubscriptionRef.set(resultRef, result),
				triggerFetch: startFetch().pipe(Effect.asVoid),
				remove: () => {
					entry.inFlight = undefined;
					entry.poller = undefined;
					entry.abortController = undefined;
					definition.entries.delete(hash);
				},
				activeCount: 0,
				invalidated: false,
				lastInactiveAt: undefined,
				inFlight: undefined,
				poller: undefined,
				abortController: undefined,
				paused: false,
			};
			definition.entries.set(hash, entry);
			entries.add(entry);
			return entry;
		});

		const stopPollingForEntry = Effect.fnUntraced(function* (
			entry: QueryEntryBase,
		) {
			if (entry.poller === undefined) {
				return;
			}
			const poller = entry.poller;
			entry.poller = undefined;
			yield* Fiber.interrupt(poller);
		});

		const startPollingForEntry = Effect.fnUntraced(function* <Arg, A, E, R>(
			entry: QueryEntry<Arg, A, E, R>,
		) {
			const intervalMs = entry.policy.refetchIntervalMs;
			if (
				intervalMs === undefined ||
				entry.activeCount === 0 ||
				!entry.isEnabled()
			) {
				yield* stopPollingForEntry(entry);
				return;
			}
			if (entry.poller !== undefined) {
				return;
			}

			const poller = yield* Effect.gen(function* () {
				while (entry.activeCount > 0) {
					yield* Effect.sleep(`${Math.max(1, intervalMs)} millis`);
					if (entry.activeCount === 0) {
						return;
					}
					if (!entry.isEnabled()) {
						continue;
					}
					if (entry.policy.networkMode === "online" && !online) {
						entry.paused = true;
						continue;
					}
					yield* entry.triggerFetch;
				}
			}).pipe(Effect.forkIn(storeScope));

			entry.poller = poller;
		});

		const restoreCancelledResult = <A, E>(
			result: QueryResult<A, E>,
		): QueryResult<A, E> => {
			if (result.isPending) {
				return initialQueryResult();
			}
			if (result.isSuccess) {
				return successQueryResult(result.data, {
					timestamp: result.dataUpdatedAt,
				});
			}
			return failureQueryResult(result.failureCause, {
				previousSuccess: result.previousSuccess,
			});
		};

		const needsRefetch = <Arg, A, E, R>(
			entry: QueryEntry<Arg, A, E, R>,
			now: number,
		): boolean => {
			const current = entry.snapshot();
			if (entry.invalidated || current.isPending || current.isError) {
				return true;
			}
			return now - current.dataUpdatedAt >= entry.policy.staleTimeMs;
		};

		const touch = Effect.fnUntraced(function* <Arg, A, E, R>(
			entry: QueryEntry<Arg, A, E, R>,
			reason: TouchReason,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);
			const isEnabled = entry.isEnabled();

			const shouldFetch =
				reason === "refresh" ||
				reason === "ensure" ||
				reason === "prefetch" ||
				(reason === "mount" &&
					isEnabled &&
					entry.definition.policy.refetchOnMount);

			if (!shouldFetch || !needsRefetch(entry, now)) {
				return;
			}

			yield* entry.triggerFetch;
		});

		const observe = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const entry = yield* getOrCreate(definition, arg);
			const wasInactive = entry.activeCount === 0;
			entry.activeCount += 1;
			entry.lastInactiveAt = undefined;
			if (wasInactive && entry.isEnabled()) {
				yield* startPollingForEntry(entry);
			}

			yield* Effect.addFinalizer((_exit) =>
				Effect.gen(function* () {
					entry.activeCount = Math.max(0, entry.activeCount - 1);
					if (entry.activeCount === 0) {
						entry.lastInactiveAt = yield* Clock.currentTimeMillis;
						yield* stopPollingForEntry(entry);
					}
				}),
			);

			yield* touch(entry, "mount");
			return entry.resultRef;
		});

		const ensure: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<A, E, R> = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const entry = yield* getOrCreate(definition, arg);
			const current = entry.current();
			if (!needsRefetch(entry, now) && current.isSuccess) {
				return current.data;
			}

			yield* entry.triggerFetch;
			if (entry.paused) {
				yield* waitForOnline();
				return yield* ensure(definition, arg);
			}
			const fiber = entry.inFlight;
			if (fiber === undefined) {
				return yield* resolveCompletedResult(entry.current());
			}
			return yield* Fiber.join(fiber);
		});

		const prefetch = <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		): Effect.Effect<void, never, R> =>
			ensure(definition, arg).pipe(
				Effect.asVoid,
				Effect.catchCause(() => Effect.void),
			);

		const refresh: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) => Effect.Effect<A, E, R> = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const entry = yield* getOrCreate(definition, arg);
			yield* entry.triggerFetch;
			if (entry.paused) {
				yield* waitForOnline();
				return yield* refresh(definition, arg);
			}
			const fiber = entry.inFlight;
			if (fiber === undefined) {
				return yield* resolveCompletedResult(entry.current());
			}
			return yield* Fiber.join(fiber);
		});

		const cancel = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const entry = definition.entries.get(hashQueryKey(definition.key(arg)));
			if (entry === undefined) {
				return;
			}

			entry.paused = false;
			entry.invalidated = false;
			const inFlight = entry.inFlight;
			const abortController = entry.abortController;
			entry.inFlight = undefined;
			entry.abortController = undefined;
			yield* entry.setResult(restoreCancelledResult(entry.current()));
			abortController?.abort();
			if (inFlight !== undefined) {
				yield* Fiber.interrupt(inFlight).pipe(
					Effect.forkIn(storeScope),
					Effect.asVoid,
				);
			}
		});

		const peek = <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		): Effect.Effect<Option.Option<QueryResult<A, E>>> =>
			Effect.sync(() => {
				const entry = definition.entries.get(hashQueryKey(definition.key(arg)));
				return entry === undefined
					? Option.none()
					: Option.some(entry.current());
			});

		const setData = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
			updater: DataUpdater<A>,
		) {
			const entry = yield* getOrCreate(definition, arg);
			const now = yield* Clock.currentTimeMillis;
			const current = entry.current();
			const next = applyDataUpdater(updater, getCurrentSuccess(current));

			entry.invalidated = false;
			yield* entry.setResult(successQueryResult(next, { timestamp: now }));
			return next;
		});

		const invalidateEntries = Effect.fnUntraced(function* (
			keys: ReactivityKeySet,
		) {
			const invalidatedHashes = toReactivityHashSet(keys);
			if (invalidatedHashes.size === 0) {
				return;
			}

			const activeEntries = new Set<QueryEntryBase>();
			for (const entry of entries) {
				for (const hash of invalidatedHashes) {
					if (entry.reactivityHashes.has(hash)) {
						entry.invalidated = true;
						if (entry.activeCount > 0 && entry.isEnabled()) {
							activeEntries.add(entry);
						}
						break;
					}
				}
			}

			for (const entry of activeEntries) {
				yield* entry.triggerFetch;
			}
		});

		const refetchActive = Effect.fnUntraced(function* (reason: EventReason) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			for (const entry of entries) {
				if (entry.activeCount === 0) {
					continue;
				}

				const enabled =
					reason === "window-focus"
						? entry.policy.refetchOnWindowFocus
						: entry.policy.refetchOnReconnect;

				if (!enabled || !entry.isEnabled() || !needsRefetchBase(entry, now)) {
					continue;
				}

				yield* entry.triggerFetch;
			}
		});

		const setOnline = Effect.fnUntraced(function* (nextOnline: boolean) {
			if (nextOnline === online) {
				return;
			}

			online = nextOnline;
			if (nextOnline) {
				yield* Deferred.succeed(onlineSignal, undefined);
				for (const entry of entries) {
					if (!entry.paused || !entry.isEnabled()) {
						continue;
					}
					yield* entry.triggerFetch;
				}
				yield* refetchActive("reconnect");
				return;
			}

			onlineSignal = yield* Deferred.make<void>();
		});

		return QueryStore.of({
			observe,
			ensure,
			peek,
			prefetch,
			refresh,
			cancel,
			setData,
			invalidate: invalidateEntries,
			onFocus: refetchActive("window-focus"),
			onOffline: setOnline(false),
			onOnline: setOnline(true),
		});
	}),
);
