import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createQueryAtomFactory } from "../EffectQuery.ts";
import { assertSome, assertSuccess } from "../testing-utils.ts";

test("paginated queries can keep separate cache entries per page", async () => {
	const pageQuery = createQueryAtomFactory({
		queryKey: (page: number) => ["projects", page],
		queryFn: (page: number) => Effect.succeed(`page:${page}`),
	});

	await Effect.runPromise(pageQuery.ensure(1));
	await Effect.runPromise(pageQuery.ensure(2));

	const first = await Effect.runPromise(pageQuery.peek(1));
	const second = await Effect.runPromise(pageQuery.peek(2));
	assertSome(first);
	assertSome(second);
	assertSuccess(first.value);
	assertSuccess(second.value);
	expect(first.value.value).toBe("page:1");
	expect(second.value.value).toBe("page:2");
});
