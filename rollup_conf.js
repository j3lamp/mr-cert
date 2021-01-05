import commonjs      from "@rollup/plugin-commonjs";
import {nodeResolve} from "@rollup/plugin-node-resolve";


export default {
    input: "client/index.js",
    output: {
        file:   "dist/index.js",
        format: "iife",
        sourcemap: true
    },
    plugins: [
        commonjs({transformMixedEsModules: true}),
        nodeResolve()
    ]
}
