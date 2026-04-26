import { expect, test } from "bun:test";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";

class Prefix extends Context.Service<Prefix, { readonly value: string }>()(
	"effect-query/concepts/query-functions.test/Prefix",
) {}

test("query functions can depend on runtime services", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const runtime = makeRuntime(Layer.succeed(Prefix, { value: "user:" }));
			const userQuery = createQueryAtomFactory({
				runtime,
				queryKey: (id: string) => ["user", id],
				queryFn: (id: string) =>
					Prefix.use((prefix) => Effect.succeed(`${prefix.value}${id}`)),
			});

			const value = yield* userQuery.ensure("1");
			expect(value).toBe("user:1");
		}),
	));
