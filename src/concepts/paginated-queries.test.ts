import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSome, assertSuccess } from "../testing-utils.ts";

test("paginated queries can keep separate cache entries per page", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const pageQuery = createQueryAtomFactory({
				queryKey: (page: number) => ["projects", page],
				queryFn: (page: number) => Effect.succeed(`page:${page}`),
			});

			yield* pageQuery.ensure(1);
			yield* pageQuery.ensure(2);

			const first = yield* pageQuery.peek(1);
			const second = yield* pageQuery.peek(2);
			assertSome(first);
			assertSome(second);
			assertSuccess(first.value);
			assertSuccess(second.value);
			expect(first.value.data).toBe("page:1");
			expect(second.value.data).toBe("page:2");
		}),
	));
