import * as Hash from "effect/Hash";
import type { QueryEntryBase, QueryKey, ReactivityKeySet } from "../types.ts";

export function hashQueryKey(key: QueryKey): string {
	return stableSerialize(key);
}

function stableSerialize(value: unknown): string {
	const seen = new WeakSet<object>();

	function serialize(current: unknown): string {
		switch (typeof current) {
			case "string":
				return JSON.stringify(current);
			case "number":
			case "boolean":
				return String(current);
			case "bigint":
				return `${String(current)}n`;
			case "undefined":
				return "undefined";
			case "symbol":
				return current.toString();
			case "function":
				return `[function:${current.name || "anonymous"}]`;
			case "object": {
				if (current === null) {
					return "null";
				}

				if (current instanceof Date) {
					return `date:${current.toISOString()}`;
				}

				if (Array.isArray(current)) {
					return `[${current.map(serialize).join(",")}]`;
				}

				if (seen.has(current)) {
					return '"[circular]"';
				}
				seen.add(current);

				const entries = Object.entries(current).sort(([left], [right]) =>
					left.localeCompare(right),
				);
				return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${serialize(entryValue)}`).join(",")}}`;
			}
		}
	}

	return serialize(value);
}

export function toReactivityHashSet(
	keys: ReactivityKeySet | undefined,
): ReadonlySet<string> {
	const hashes = new Set<string>();
	if (keys === undefined) {
		return hashes;
	}

	if (Array.isArray(keys)) {
		for (const key of keys) {
			hashes.add(String(stringOrHash(key)));
		}
		return hashes;
	}

	if (!isReactivityKeyRecord(keys)) {
		return hashes;
	}

	for (const [key, ids] of Object.entries(keys)) {
		hashes.add(key);
		for (const id of ids) {
			hashes.add(`${key}:${String(stringOrHash(id))}`);
		}
	}

	return hashes;
}

function isReactivityKeyRecord(
	keys: ReactivityKeySet,
): keys is Readonly<Record<string, ReadonlyArray<unknown>>> {
	return !Array.isArray(keys);
}

export function needsRefetchBase(entry: QueryEntryBase, now: number): boolean {
	const current = entry.snapshot();
	if (entry.invalidated || current.isPending || current.isError) {
		return true;
	}
	return now - current.dataUpdatedAt >= entry.policy.staleTimeMs;
}

function stringOrHash(value: unknown): string | number {
	switch (typeof value) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
			return String(value);
		default:
			return Hash.hash(value);
	}
}
