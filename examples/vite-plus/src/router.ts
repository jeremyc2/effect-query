import {
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import {
	OverviewPage,
	RootLayout,
	TaskDetailPage,
	TasksPage,
} from "./routes.tsx";

const rootRoute = createRootRoute({
	component: RootLayout,
});

const overviewRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: OverviewPage,
});

const tasksRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/tasks",
	component: TasksPage,
});

const taskDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/tasks/$taskId",
	component: TaskDetailPage,
});

export const router = createRouter({
	routeTree: rootRoute.addChildren([
		overviewRoute,
		tasksRoute,
		taskDetailRoute,
	]),
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
