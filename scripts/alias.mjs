/**
 * Laat `node scripts/*.ts` de "@/..."-imports van de app vinden.
 *
 * Node 24 strippt TypeScript zelf, dus er is geen testrunner of build nodig;
 * het enige wat mist is de padalias uit tsconfig.json. Vandaar deze hook.
 */
import { registerHooks } from "node:module";

const srcRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return { url: new URL(`${specifier.slice(2)}.ts`, srcRoot).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
