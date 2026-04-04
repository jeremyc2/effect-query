import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Schema from "effect/Schema";
import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
} from "effect/unstable/http";
import { type SubmitEvent, useRef } from "react";

const httpClientRuntime = ManagedRuntime.make(FetchHttpClient.layer);

class MissingFormFieldError extends Schema.TaggedErrorClass<MissingFormFieldError>()(
	"MissingFormFieldError",
	{
		fieldName: Schema.String,
	},
) {}

class UnsupportedMethodError extends Schema.TaggedErrorClass<UnsupportedMethodError>()(
	"UnsupportedMethodError",
	{
		method: Schema.String,
	},
) {}

class InvalidEndpointError extends Schema.TaggedErrorClass<InvalidEndpointError>()(
	"InvalidEndpointError",
	{
		endpoint: Schema.String,
		reason: Schema.String,
	},
) {}

export function APITester() {
	const responseInputRef = useRef<HTMLTextAreaElement>(null);

	const setResponseValue = (value: string) => {
		const responseInput = responseInputRef.current;
		if (responseInput !== null) {
			responseInput.value = value;
		}
	};

	const getStringField = (formData: FormData, fieldName: string) => {
		const value = formData.get(fieldName);
		return typeof value === "string"
			? Effect.succeed(value)
			: Effect.fail(new MissingFormFieldError({ fieldName }));
	};

	const getMethod = (
		formData: FormData,
	): Effect.Effect<
		"GET" | "PUT",
		MissingFormFieldError | UnsupportedMethodError
	> =>
		Effect.flatMap(getStringField(formData, "method"), (method) =>
			method === "GET" || method === "PUT"
				? Effect.succeed(method)
				: Effect.fail(new UnsupportedMethodError({ method })),
		);

	const makeRequest = (url: URL, method: "GET" | "PUT") =>
		method === "GET"
			? HttpClientRequest.get(url, { acceptJson: true })
			: HttpClientRequest.put(url, { acceptJson: true });

	const requestEndpoint = Effect.fn("APITester.requestEndpoint")(function* (
		form: HTMLFormElement,
	) {
		const formData = new FormData(form);
		const endpoint = yield* getStringField(formData, "endpoint");
		const method = yield* getMethod(formData);
		const url = yield* Effect.try({
			try: () => new URL(endpoint, location.href),
			catch: (error) =>
				new InvalidEndpointError({ endpoint, reason: String(error) }),
		});
		const client = yield* HttpClient.HttpClient;
		const response = yield* client.execute(makeRequest(url, method));
		return yield* response.text;
	});

	const testEndpoint = (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		void httpClientRuntime
			.runPromise(requestEndpoint(e.currentTarget))
			.then(setResponseValue, (error) => setResponseValue(String(error)));
	};

	return (
		<div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
			<form
				onSubmit={testEndpoint}
				className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
			>
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
					type="submit"
					className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
				>
					Send
				</button>
			</form>
			<textarea
				ref={responseInputRef}
				readOnly
				placeholder="Response will appear here..."
				className="w-full min-h-[140px] bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono resize-y focus:border-[#f3d5a3] placeholder-[#fbf0df]/40"
			/>
		</div>
	);
}
