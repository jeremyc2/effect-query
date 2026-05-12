# Consider Biome `noBaseToString` for query key hashing

Biome `2.4.15` added the nursery rule `noBaseToString`, which reports stringification that would fall back to JavaScript's default object formatting.

This may serve Effect Query well because query key hashing already has careful stringification logic in `src/effect-query/internal/query-key.ts`. A small follow-up could trial the rule against that module and decide whether to enable it directly, enable it with targeted options, or leave the current explicit conversions documented as intentional.

Source: https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.4.15
