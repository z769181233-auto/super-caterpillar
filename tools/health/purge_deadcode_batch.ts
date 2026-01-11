import { Project, SyntaxKind, ExportDeclaration, ExportSpecifier } from 'ts-morph';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  return idx >= 0 ? args[idx + 1] : null;
};

const inFile = getArg('--in');
const reportFile = getArg('--report');

if (!inFile || !reportFile) {
  console.error('Usage: tsx purge_deadcode_batch.ts --in <batch.json> --report <report.json>');
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

const report = {
  processed: [],
  skipped: [],
  errors: [],
};

for (const item of batch) {
  try {
    console.log(`Processing ${item.name} in ${item.file}`);
    let sourceFile = project.getSourceFile(item.file);
    if (!sourceFile) {
      project.addSourceFileAtPath(item.file);
      sourceFile = project.getSourceFile(item.file);
    }

    if (!sourceFile) {
      report.errors.push({ item, error: 'File not found in project' });
      continue;
    }

    // Strategy:
    // 1. Find declaration of 'name'
    // 2. If it has 'export' keyword, remove it (demote to local).
    // 3. BUT ts-prune often finds "unused declarations". If we just remove 'export', it might become "unused local".
    //    Ideally we remove the whole thing if it's safe.
    //    Review Requirement: "type-only export priority" -> remove 'export' keyword.
    //    "Confirm no reference value export" -> delete.

    // For automation safety in Batch 1: STRICTLY DEMOTE (remove export) OR DELETE IF IT IS A RE-EXPORT.

    // Handle Re-exports: export { Foo } from './bar';
    const exportDecls = sourceFile.getExportDeclarations();
    let handled = false;

    for (const ed of exportDecls) {
      const named = ed.getNamedExports();
      const target = named.find((ne) => ne.getName() === item.name);
      if (target) {
        // It is a re-export: export { Foo }
        // We should remove this specifier.
        // Explicitly verify type: target is ExportSpecifier
        if (target.getKind() === SyntaxKind.ExportSpecifier) {
          target.remove(); // Removes just "Foo" from "export { Foo, Bar }" or the whole line if empty
          handled = true;
          // If the export declaration is now empty, remove it? ts-morph might handle this or leave "export {};"
          if (ed.getNamedExports().length === 0 && !ed.getModuleSpecifier()) {
            ed.remove();
          }
        }
        break;
      }
    }

    if (handled) {
      report.processed.push(item);
      sourceFile.saveSync();
      continue;
    }

    // Handle Direct Exports: export const Foo = ...; export class Bar ...
    // We look for the symbol.
    // Doing this by name for top-level vars/functions/classes/interfaces

    // Helper to check and toggle export
    const tryDemote = (node) => {
      // Check if node is exportable and exported
      // Use ts-morph's setIsExported if available
      if (typeof node.setIsExported === 'function') {
        if (node.isExported()) {
          node.setIsExported(false);
          return true;
        }
      }

      // Fallback for manual modifier check if setIsExported missing (rare in recent ts-morph for Exportable)
      // But keep simple: if setIsExported worked, we returned.

      if (node.getModifiers) {
        const modifier = node.getModifiers().find((m) => m.getKind() === SyntaxKind.ExportKeyword);
        if (modifier) {
          try {
            // In older ts-morph versions modifier is a Node, it has remove()
            // Ensure it has remove method
            if (typeof modifier.remove === 'function') {
              modifier.remove();
              return true;
            } else {
              // If modifier is a compiler wrapper without remove, try parent manipulation?
              // But usually modifier.remove works.
              // If error "modifier.remove is not a function", then modifier is likely not what we think.
              // But let's trust setIsExported covers 99% cases.
            }
          } catch (e) {
            // ignore fallback error
          }
        }
      }
      return false;
    };

    const declarations = [
      ...sourceFile.getClasses(),
      ...sourceFile.getInterfaces(),
      ...sourceFile.getTypeAliases(),
      ...sourceFile.getFunctions(),
      ...sourceFile
        .getVariableStatements()
        .flatMap((v) => v.getDeclarationList().getDeclarations()),
      ...sourceFile.getEnums(),
    ];

    const decl = declarations.find((d) => {
      // VariableDeclaration doesn't have create/name like ClassDeclaration directly sometimes
      // But getName() usually works.
      return d.getName?.() === item.name;
    });

    if (decl) {
      // For VariableDeclaration, the 'export' is on the VariableStatement
      if (decl.getKind() === SyntaxKind.VariableDeclaration) {
        const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (stmt) {
          if (tryDemote(stmt)) {
            handled = true;
          }
        }
      } else {
        if (tryDemote(decl)) {
          handled = true;
        }
      }
    }

    if (handled) {
      report.processed.push(item);
      sourceFile.saveSync();
    } else {
      report.skipped.push({ item, reason: 'Could not find export modifier or re-export' });
    }
  } catch (e) {
    console.error(e);
    report.errors.push({ item, error: e.message });
  }
}

fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
