import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
	fmt: {
		ignorePatterns: ["dist/**"],
		sortPackageJson: false,
		useTabs: true,
	},
	plugins: [tailwindcss(), react()],
});
