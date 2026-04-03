---
description: How to bump the app version after making changes
---
# Version Bump Workflow

After making **any** code change to the PK Fit Pro application, you MUST bump the patch version in `src/shared/config/version.ts`.

## Steps

// turbo-all

1. Open `src/shared/config/version.ts`
2. Increment the patch number (last digit): e.g. `v1.0.0` → `v1.0.1` → `v1.0.2`
3. For larger changes (new features), increment the minor version: e.g. `v1.0.2` → `v1.1.0`
4. For breaking/major changes, increment the major version: e.g. `v1.1.0` → `v2.0.0`

## Example

```diff
-export const APP_VERSION = 'v1.0.0';
+export const APP_VERSION = 'v1.0.1';
```

## Important

- This MUST be done on **every** change, even small bug fixes
- The version is displayed on all profile pages below "Alterar Senha"
- Do NOT skip this step — the user relies on it to track releases
