import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createQueryAtomFactory } from "../EffectQuery.ts";

test("parallel queries can resolve independently", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				queryFn: (id: string) =>
					Effect.sleep("5 millis").pipe(
						Effect.andThen(Effect.succeed(`user:${id}`)),
					),
			});
			const projectQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["project", id],
				queryFn: (id: string) =>
					Effect.sleep("5 millis").pipe(
						Effect.andThen(Effect.succeed(`project:${id}`)),
					),
			});

			const [user, project] = yield* Effect.all([
				userQuery.ensure("1"),
				projectQuery.ensure("1"),
			]);

			expect(user).toBe("user:1");
			expect(project).toBe("project:1");
		}),
	));
