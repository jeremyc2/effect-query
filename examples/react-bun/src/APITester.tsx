import { useAtomValue } from "@effect/atom-react";
import { Effect, Random } from "effect";
import { createQueryAtom, getSuccess, makeRuntime } from "../../../src/index";

const queryRuntime = makeRuntime();

const helloWorldAtom = createQueryAtom({
	runtime: queryRuntime,
	queryKey: ["hello-world"],
	queryFn: Random.nextUUIDv4.pipe(Effect.delay("4 seconds")),
	staleTime: "2 seconds",
});

export function APITester() {
	const helloWorldResult = useAtomValue(helloWorldAtom);
	const helloWorld = getSuccess(helloWorldResult);
	return (
		<div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
			<form className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full">
				<select
					name="method"
					className="bg-[#fbf0df] text-[#1a1a1a] py-1.5 px-3 rounded-lg font-bold text-sm min-w-0 appearance-none cursor-pointer hover:bg-[#f3d5a3] transition-colors duration-100"
				>
					<option value="GET" className="py-1">
						GET
					</option>
					<option value="PUT" className="py-1">
						PUT
					</option>
				</select>
				<input
					type="text"
					name="endpoint"
					defaultValue="/api/hello"
					className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
					placeholder="/api/hello"
				/>
				<button
					type="button"
					onClick={() => {}}
					className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
				>
					Send
				</button>
			</form>
			<textarea
				readOnly
				placeholder="Response will appear here..."
				className="w-full min-h-[140px] bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono resize-y focus:border-[#f3d5a3] placeholder-[#fbf0df]/40"
				value={helloWorld.valueOrUndefined}
			/>
		</div>
	);
}
