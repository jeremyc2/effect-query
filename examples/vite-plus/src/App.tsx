import { RouterProvider } from "@tanstack/react-router";
import { DemoProvider } from "./demo/context.tsx";
import { router } from "./router.ts";

export default function App() {
	return (
		<DemoProvider>
			<RouterProvider router={router} />
		</DemoProvider>
	);
}
