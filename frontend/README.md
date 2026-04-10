# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Frontend tests

This project keeps Vitest split into two paths.

- `npm test`: runs the default quick verification command
- `npm run test:verify`: runs the same quick verification command explicitly
- `npm run test:node:quick`: runs the currently verified fast node check (`date-text.test.ts`)
- `npm run test:node:full`: runs the full node-only suite with `vitest.node.config.ts`
- `npm run test:node`: alias for `npm run test:node:full`
- `npm run test:date-text`: alias for `npm run test:node:quick`
- `npm run test:dom`: runs the DOM test suite once through the fail-fast wrapper
- `npm run test:dom:watch`: starts the DOM test runner in watch mode through the same wrapper
- `npm run test:run`: alias for `npm run test:dom`
- `npm run test:statistics-page`: runs the DOM statistics page test through the same wrapper

### Command guide

| Command | Purpose | Expected behavior in this environment |
| --- | --- | --- |
| `npm test` / `npm run test:verify` | Fast, predictable verification for everyday checks | Should finish quickly because it only runs the verified quick node test |
| `npm run test:node:quick` | Same fast node-only verification | Assertion failures mean a real test failure |
| `npm run test:node:full` | Full node-only verification | May take longer than a smoke check; a shell timeout is not the same as an assertion failure |
| `npm run test:dom` / `npm run test:statistics-page` | DOM/jsdom verification through the fail-fast wrapper | On unsupported environments, exits early with guidance instead of hanging |

Use `npm test` while iterating locally when you want a short and predictable answer. Use `npm run test:node:full` when you want broader node-side confidence and can allow more time for the suite to finish.

The DOM wrapper keeps the existing `vitest.dom.config.ts` structure, but it checks the runtime first. If the current environment is a known unsupported case, or if `jsdom` / `@testing-library/jest-dom/vitest` hangs during import preflight, it exits quickly with a non-zero code and prints guidance instead of looking stuck forever.

Known limitation:

- Running the repository from WSL on a `/mnt/...` Windows-mounted path can block during DOM test startup. In that case the runner stops early and reports an environment constraint, not an application test failure.

Result semantics:

- A Vitest assertion failure means the test itself failed.
- A DOM fail-fast exit on an unsupported environment means the test was blocked before execution.
- A shell timeout means the command did not finish within the allowed time window; by itself, that does not prove an assertion failure.

Recommended DOM test locations:

- Move the repository into the WSL Ubuntu home directory, then run `npm run test:dom`, `npm run test:dom:watch`, or `npm run test:statistics-page`
- Or run the same DOM test commands from a native Windows path / terminal

## Playwright full-stack tests

Use the full-stack Playwright commands when you need the real frontend talking to the already-available backend and database stack.

Preconditions:

- The backend full-stack target must already be running and reachable through the frontend `/api` proxy path.
- The database and seed data required by the scenario under test must already be prepared.

How stale frontend reuse is avoided:

- `playwright.full-stack.config.ts` now starts its own dedicated Vite frontend server on `http://127.0.0.1:4174`.
- `reuseExistingServer` is disabled for that full-stack config, so Playwright does not silently attach to an older frontend process.
- The dedicated port keeps full-stack runs separate from the default Vite dev port and from any older server left on `4173`.

Default commands:

- `npm run test:e2e:full-stack`
- `npm run test:e2e:full-stack:headed`

Specific spec example:

- `npm run test:e2e:full-stack -- e2e/full-stack/client-scale-trend.full-stack.spec.ts`

If port `4174` is already in use, stop that stray process first. The command is expected to fail fast instead of reusing an unknown older frontend build.
