// See: https://rollupjs.org/introduction/

import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from '@rollup/plugin-terser';

const config = {
  input: "src/index.ts",
  output: {
    file: "dist/index.mjs",
    format: "es",
    esModule: true,
    sourcemap: true,
  },
  plugins: [
    // @ts-expect-error masquerading as CJS, see: https://arethetypeswrong.github.io/
    typescript({ outputToFilesystem: true }),
    nodeResolve({ preferBuiltins: true }),
    // @ts-expect-error masquerading as CJS, see: https://arethetypeswrong.github.io/
    commonjs(),
    // @ts-expect-error masquerading as CJS, see: https://arethetypeswrong.github.io/
    terser()
  ],
};

export default config;
