import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { createQueryAtomFactory } from "../EffectQuery.ts";

test("query retries use the configured retry schedule", async () => {
	let attempts = 0;
	const userQuery = createQueryAtomFactory({
		queryKey: (id: string) => ["user", id],
		retry: Schedule.recurs(1),
		queryFn: (id: string) =>
			Effect.suspend(() => {
				attempts += 1;
				return attempts === 1
					? Effect.fail("boom")
					: Effect.succeed(`${id}:ok`);
			}),
	});

	const value = await Effect.runPromise(userQuery.ensure("1"));
	expect(value).toBe("1:ok");
	expect(attempts).toBe(2);
});
