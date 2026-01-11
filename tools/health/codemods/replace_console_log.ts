import { Project, SyntaxKind, Node } from 'ts-morph';
import fs from 'fs';

// Args: --manifest <file> --limit <N> --out <report.json>
const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  return idx >= 0 ? args[idx + 1] : null;
};
const manifestFile = getArg('--manifest');
const limit = parseInt(getArg('--limit') || '100', 10);
const outFile = getArg('--out');

if (!manifestFile || !outFile) {
  console.error('Usage');
  process.exit(1);
}

// Parse manifest (rg output: file:line:content)
const raw = fs.readFileSync(manifestFile, 'utf8');
const lines = raw.split('\n').filter(Boolean);

// Group by file
const filesMap = new Map();
lines.forEach((l) => {
  const [file] = l.split(':');
  filesMap.set(file, true);
});
const files = Array.from(filesMap.keys());

const project = new Project();

const report = { processed: [], errors: [], skipped: [] };
let count = 0;

for (const filePath of files) {
  if (count >= limit) break;
  try {
    if (!fs.existsSync(filePath)) continue;
    project.addSourceFileAtPath(filePath);
    const sourceFile = project.getSourceFile(filePath);

    if (!sourceFile) continue;

    let modified = false;

    // Find console.log/error/warn
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
      const expr = c.getExpression();
      if (Node.isPropertyAccessExpression(expr)) {
        const obj = expr.getExpression();
        const prop = expr.getName(); // log, warn, error
        if (Node.isIdentifier(obj) && obj.getText() === 'console') {
          return ['log', 'warn', 'error'].includes(prop);
        }
      }
      return false;
    });

    // Strategy A: Not in class -> process.stdout.write
    // Strategy B: In class -> Inject logger or use logger

    for (const call of calls) {
      if (count >= limit) break;

      const method = call.getExpression().getName(); // log/warn/error
      const args = call.getArguments().map((a) => a.getText());

      // Check context
      const classDecl = call.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);

      if (classDecl) {
        // Check if class has 'logger' property
        // Better: check if NestJS class (has @Injectable or @Controller?)
        // Or just check if "this.logger" exists or can be added.
        // For Batch 2:
        // If "this.logger" exists, replace.
        // If not, AND it's a NestJS class, inject it.
        // Else, fallback to process.stdout.

        // Simplified for now:
        // Check if 'private readonly logger' property exists
        const hasLogger = classDecl.getProperty('logger');

        if (hasLogger) {
          // Replace with this.logger.log/warn/error
          // method mapping: log->log, warn->warn, error->error
          call.replaceWithText(`this.logger.${method}(${args.join(', ')})`);
          modified = true;
          count++;
          report.processed.push(filePath);
        } else {
          // Check if we can inject
          // Heuristic: Is it decorated with Injectable/Controller?
          const decorators = classDecl.getDecorators();
          const isNest = decorators.some((d) =>
            ['Injectable', 'Controller', 'Processor'].includes(d.getName())
          );

          if (isNest) {
            // Inject logger
            // 1. Add import { Logger } from '@nestjs/common'
            // 2. Add property private readonly logger = new Logger(ClassName.name);
            // 3. Replace call

            // Add import if missing
            const nestImport = sourceFile.getImportDeclaration('@nestjs/common');
            if (!nestImport) {
              sourceFile.addImportDeclaration({
                moduleSpecifier: '@nestjs/common',
                namedImports: ['Logger'],
              });
            } else {
              const named = nestImport.getNamedImports();
              if (!named.some((n) => n.getName() === 'Logger')) {
                nestImport.addNamedImport('Logger');
              }
            }

            // Add property
            classDecl.insertProperty(0, {
              name: 'logger',
              scope: 'private',
              isReadonly: true,
              initializer: `new Logger(${classDecl.getName()}.name)`,
            });

            call.replaceWithText(`this.logger.${method}(${args.join(', ')})`);
            modified = true;
            count++;
            report.processed.push(filePath);
          } else {
            // Not nest, use stdout logic (Rule A)
            applyStdoutStartgy(sourceFile, call, args, method);
            modified = true;
            count++;
            report.processed.push(filePath);
          }
        }
      } else {
        // Not in class (Script/Function) -> Rule A
        applyStdoutStartgy(sourceFile, call, args, method);
        modified = true;
        count++;
        report.processed.push(filePath);
      }
    }

    if (modified) {
      sourceFile.saveSync();
    }
  } catch (e) {
    report.errors.push({ file: filePath, error: e.message });
  }
}

function applyStdoutStartgy(sourceFile, call, args, method) {
  // Replace with process.stdout.write(util.format(...) + "\n")
  // Add import * as util from 'util'
  const utilImport = sourceFile.getImportDeclaration('util');
  if (!utilImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'util',
      namespaceImport: 'util',
    });
  }

  const stream = method === 'error' ? 'stderr' : 'stdout';
  // util.format handle multiple args like console.log
  call.replaceWithText(`process.${stream}.write(util.format(${args.join(', ')}) + "\\n")`);
}

fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
