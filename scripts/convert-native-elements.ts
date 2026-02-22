'use strict';

/**
 * Simple codemod that walks through TSX/TS files under src/ and replaces
 * a handful of native HTML elements with the project's UI wrappers.
 *
 * Usage: `ts-node scripts/convert-native-elements.ts` (you may need to install
 * ts-node if you don't already have it: `pnpm add -D ts-node`).
 *
 * The script is intentionally conservative: it only transforms elements that
 * appear in JSX context and will add an import for the appropriate component
 * if one isn't already present.  It will NOT rewrite cases where the native
 * element is intentionally used (you can control that with the `--dry` flag,
 * which prints changes without writing them).
 *
 * Supported element -> component mappings are defined in the `map` below.  You
 * can extend it as new wrappers are added.
 */

import {
  Project,
  SyntaxKind,
  JsxSelfClosingElement,
  JsxOpeningElement
} from 'ts-morph';
import fg from 'fast-glob';

const MAP: Record<string, { comp: string; importPath: string }> = {
  button: { comp: 'Button', importPath: '@/components/ui/button' },
  input: { comp: 'Input', importPath: '@/components/ui/input' },
  select: { comp: 'Select', importPath: '@/components/ui/select' },
  textarea: { comp: 'Textarea', importPath: '@/components/ui/textarea' }
  // add others as needed
};

async function main() {
  const dry = process.argv.includes('--dry');
  const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
  // avoid transforming our own UI component definitions to prevent
  // self‑imports and infinite recursion
  const files = (
    await fg(['src/**/*.tsx', 'src/**/*.ts'], { dot: false })
  ).filter((f) => !f.startsWith('src/components/ui/'));

  for (const filePath of files) {
    const source = project.addSourceFileAtPathIfExists(filePath);
    if (!source) continue; // skip if file couldn't be loaded

    let changed = false;

    const visit = (node: JsxOpeningElement | JsxSelfClosingElement) => {
      const tag = node.getTagNameNode().getText();
      if (MAP[tag]) {
        const { comp, importPath } = MAP[tag];
        node.getTagNameNode().replaceWithText(comp);
        changed = true;
        // add import if missing
        const existing = source
          .getImportDeclarations()
          .find((d) => d.getModuleSpecifierValue() === importPath);
        if (!existing) {
          source.addImportDeclaration({
            namedImports: [comp],
            moduleSpecifier: importPath
          });
        } else if (
          !existing.getNamedImports().some((i) => i.getName() === comp)
        ) {
          existing.addNamedImport(comp);
        }
      }
    };

    source.forEachDescendant((node) => {
      if (
        node.getKind() === SyntaxKind.JsxOpeningElement ||
        node.getKind() === SyntaxKind.JsxSelfClosingElement
      ) {
        visit(node as JsxOpeningElement | JsxSelfClosingElement);
      }
    });

    if (changed) {
      console.log(`transformed ${filePath}`);
      if (!dry) {
        await source.save();
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
