import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSome, assertSuccess } from "../testing-utils.ts";

test("query keys partition cache entries by argument", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const userQuery = createQueryAtomFactory({
				queryKey: (id: string) => ["user", id],
				queryFn: (id: string) => Effect.succeed(`${id}:fetched`),
			});

			yield* userQuery.setData("1", "1:seeded");
			const first = yield* userQuery.peek("1");
			const second = yield* userQuery.peek("2");

			assertSome(first);
			assertSuccess(first.value);
			expect(first.value.data).toBe("1:seeded");
			expect(second.pipe(Option.isNone)).toBe(true);
		}),
	));
