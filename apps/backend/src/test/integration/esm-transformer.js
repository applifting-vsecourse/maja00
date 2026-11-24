// BetterAuth and several of its dependencies ship ES modules only, while Jest
// runs CommonJS. The real server doesn't care (Node 24 can require() ES
// modules), but Jest has its own module loader that can't. This compiles those
// files to CommonJS for the integration tests and passes everything that is
// already CommonJS through untouched.
const ts = require('typescript');

const ESM_SYNTAX = /^\s*(import\s*[\w{*'"]|export\s)/m;

module.exports = {
  process(sourceText, sourcePath) {
    if (!sourcePath.endsWith('.mjs') && !ESM_SYNTAX.test(sourceText)) {
      return { code: sourceText };
    }
    // TypeScript always keeps .mjs files as ES modules, so compile under a
    // .js name to get CommonJS out.
    const { outputText } = ts.transpileModule(sourceText, {
      fileName: sourcePath.replace(/\.mjs$/, '.js'),
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        allowJs: true,
        esModuleInterop: true,
      },
    });
    return { code: outputText };
  },
};
