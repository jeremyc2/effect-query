import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as ServiceMap from "effect/ServiceMap";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
	applyDataUpdater,
	getCurrentSuccess,
	hashQueryKey,
	needsRefetchBase,
	resolveCompletedResult,
	toReactivityHashSet,
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
		readonly setData: <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
			updater: DataUpdater<A>,
		) => Effect.Effect<A, never, R>;
		readonly invalidate: (keys: ReactivityKeySet) => Effect.Effect<void>;
		readonly onFocus: Effect.Effect<void>;
		readonly onOnline: Effect.Effect<void>;
	}
>()("effect-query/effect-query/store/QueryStore") {}

export const QueryStoreLayer = Layer.effect(
	QueryStore,
	Effect.gen(function* () {
		const storeScope = yield* Effect.scope;
		const entries = new Set<QueryEntryBase>();

		const pruneExpired = Effect.fnUntraced(function* (now: number) {
			for (const entry of entries) {
				if (entry.activeCount > 0 || entry.lastInactiveAt === undefined) {
					continue;
				}

				const ttl = entry.policy.idleTimeToLiveMs;
				if (now - entry.lastInactiveAt < ttl) {
					continue;
				}

				const inFlight = entry.inFlight;
				entry.inFlight = undefined;
				entry.remove();
				entries.delete(entry);
				if (inFlight !== undefined) {
					yield* Fiber.interrupt(inFlight);
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
					Effect.succeed(
						Effect.suspend(() => {
							let fetchEffect: Effect.Effect<A, E, R> = definition.query(arg);
							if (definition.policy.retry !== undefined) {
								fetchEffect = fetchEffect.pipe(
									Effect.retry(definition.policy.retry),
								);
							}
							return Effect.provideServices(fetchEffect, services);
						}),
					),
			);
			const resultRef = yield* SubscriptionRef.make<QueryResult<A, E>>(
				AsyncResult.initial(),
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
							Option.some(current).pipe(AsyncResult.waitingFrom),
						);

						const fiber = yield* entry.runQuery.pipe(
							Effect.onExit((exit) =>
								Effect.gen(function* () {
									const previous = entry.current();
									entry.inFlight = undefined;
									entry.invalidated = false;
									yield* entry.setResult(
										AsyncResult.fromExitWithPrevious(
											exit,
											Option.some(previous),
										),
									);
								}),
							),
							Effect.forkIn(storeScope),
						);

						entry.inFlight = fiber;
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
				lock,
				snapshot: () => SubscriptionRef.getUnsafe(resultRef),
				current: () => SubscriptionRef.getUnsafe(resultRef),
				setResult: (result) => SubscriptionRef.set(resultRef, result),
				triggerFetch: startFetch().pipe(Effect.asVoid),
				remove: () => {
					entry.inFlight = undefined;
					definition.entries.delete(hash);
				},
				activeCount: 0,
				invalidated: false,
				lastInactiveAt: undefined,
				inFlight: undefined,
			};
			definition.entries.set(hash, entry);
			entries.add(entry);
			return entry;
		});

		const needsRefetch = <Arg, A, E, R>(
			entry: QueryEntry<Arg, A, E, R>,
			now: number,
		): boolean => {
			const current = entry.snapshot();
			if (
				entry.invalidated ||
				AsyncResult.isInitial(current) ||
				AsyncResult.isFailure(current)
			) {
				return true;
			}
			return now - current.timestamp >= entry.policy.staleTimeMs;
		};

		const touch = Effect.fnUntraced(function* <Arg, A, E, R>(
			entry: QueryEntry<Arg, A, E, R>,
			reason: TouchReason,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const shouldFetch =
				reason === "refresh" ||
				reason === "ensure" ||
				reason === "prefetch" ||
				(reason === "mount" && entry.definition.policy.refetchOnMount);

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
			entry.activeCount += 1;
			entry.lastInactiveAt = undefined;

			yield* Effect.addFinalizer((_exit) =>
				Effect.gen(function* () {
					entry.activeCount = Math.max(0, entry.activeCount - 1);
					if (entry.activeCount === 0) {
						entry.lastInactiveAt = yield* Clock.currentTimeMillis;
					}
				}),
			);

			yield* touch(entry, "mount");
			return entry.resultRef;
		});

		const ensure = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const entry = yield* getOrCreate(definition, arg);
			const current = entry.current();
			if (!needsRefetch(entry, now) && AsyncResult.isSuccess(current)) {
				return current.value;
			}

			yield* entry.triggerFetch;
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

		const refresh = Effect.fnUntraced(function* <Arg, A, E, R>(
			definition: InternalQuery<Arg, A, E, R>,
			arg: Arg,
		) {
			const now = yield* Clock.currentTimeMillis;
			yield* pruneExpired(now);

			const entry = yield* getOrCreate(definition, arg);
			yield* entry.triggerFetch;
			const fiber = entry.inFlight;
			if (fiber === undefined) {
				return yield* resolveCompletedResult(entry.current());
			}
			return yield* Fiber.join(fiber);
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
			yield* entry.setResult(AsyncResult.success(next, { timestamp: now }));
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
						if (entry.activeCount > 0) {
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

				if (!enabled || !needsRefetchBase(entry, now)) {
					continue;
				}

				yield* entry.triggerFetch;
			}
		});

		return QueryStore.of({
			observe,
			ensure,
			peek,
			prefetch,
			refresh,
			setData,
			invalidate: invalidateEntries,
			onFocus: refetchActive("window-focus"),
			onOnline: refetchActive("reconnect"),
		});
	}),
);
