import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { createQueryAtomFactory, makeRuntime } from "../EffectQuery.ts";

class Prefix extends ServiceMap.Service<Prefix, { readonly value: string }>()(
	"effect-query/concepts/query-functions.test/Prefix",
) {}

test("query functions can depend on runtime services", async () => {
	const runtime = makeRuntime(Layer.succeed(Prefix, { value: "user:" }));
	const userQuery = createQueryAtomFactory({
		runtime,
		queryKey: (id: string) => ["user", id],
		queryFn: (id: string) =>
			Prefix.use((prefix) => Effect.succeed(`${prefix.value}${id}`)),
	});

	const value = await Effect.runPromise(userQuery.ensure("1"));
	expect(value).toBe("user:1");
});
