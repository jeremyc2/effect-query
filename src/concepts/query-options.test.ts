import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { createQueryAtomFactory, queryOptions } from "../EffectQuery.ts";

test("queryOptions returns a query config that createQueryAtomFactory accepts", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const options = queryOptions({
				queryKey: (id: string) => ["user", id],
				staleTime: "1 minute",
				queryFn: (id: string) => Effect.succeed(`${id}:ok`),
			});

			const userQuery = createQueryAtomFactory(options);
			expect(yield* userQuery.ensure("1")).toBe("1:ok");
		}),
	));
