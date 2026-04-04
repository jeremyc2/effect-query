import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createContext, type ReactNode, use, useState } from "react";
import { createDemoModel, type DemoModel } from "./model.ts";

export interface DemoContextValue {
	readonly model: DemoModel;
	readonly registry: AtomRegistry.AtomRegistry;
}

const defaultContextValue: DemoContextValue = {
	model: createDemoModel(),
	registry: AtomRegistry.make(),
};

const DemoContext = createContext<DemoContextValue>(defaultContextValue);

export function DemoProvider(props: { readonly children: ReactNode }) {
	const [model] = useState(createDemoModel);
	const [registry] = useState(() => AtomRegistry.make());

	return (
		<DemoContext.Provider value={{ model, registry }}>
			{props.children}
		</DemoContext.Provider>
	);
}

export const useDemo = () => use(DemoContext);
