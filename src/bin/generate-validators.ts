import * as TJS from 'typescript-json-schema';
import * as TS from 'typescript';
import fs from 'graceful-fs';
import path from 'path';
import { mkdirp } from 'fs-extra';
import { promisify } from 'util';

import { formatJSON } from '../serialization';
import { OperationalError } from '../errors';
import { paths, resolveRequire } from '../environment';
import { runAsScript } from '../scripts';

const writeFileAsync = promisify(fs.writeFile);

const TYPE_FILES = [
  'api.ts',
  'config.ts'
];

/**
 * Generate validators for a subset of types
 */
async function generateValidators(): Promise<void> {
  await mkdirp(paths.validatorsDir);

  let index = 0;
  const lastIndex = TYPE_FILES.length - 1;

  while (index <= lastIndex) {
    await generateValidator(path.join(paths.typesDir, TYPE_FILES[index]));

    if (index < lastIndex) {
      console.log();
    }

    index++;
  }
}

/**
 * Generate validator code for all types in a file
 */
async function generateValidator(tsFile: string): Promise<void> {
  console.log(path.relative(paths.srcDir, tsFile));

  const program = TJS.getProgramFromFiles([tsFile]);

  const generator = TJS.buildGenerator(program, {
    ref: false,
    required: true
  });

  if (!generator) {
    throw new OperationalError(`Could not parse types in file: ${tsFile}`);
  }

  const exportedSymbols = generator.getSymbols().reduce(function(previous: Record<string, boolean>, symbol) {
    previous[symbol.name] = symbol.symbol.declarations.some(function({ modifiers }) {
      return modifiers && modifiers.some(m => m.kind === TS.SyntaxKind.ExportKeyword);
    });

    return previous;
  }, {});

  const symbols = generator
    .getMainFileSymbols(program)
    .filter(s => exportedSymbols[s])
    .sort();

  const fileName = path.basename(tsFile, '.ts');
  const dirPath = path.join(paths.validatorsDir, fileName);
  const schemaFile = path.join(dirPath, 'schema.json');
  const codeFile = path.join(dirPath, 'index.ts');

  await mkdirp(dirPath);

  await writeFileAsync(
    schemaFile,
    formatJSON(generator.getSchemaForSymbols(symbols)) + '\n'
  );

  await writeFileAsync(
    path.join(dirPath, 'index.ts'),
    generateValidatorCode(tsFile, schemaFile, codeFile, symbols) + '\n'
  );

  console.log(` => ${path.relative(paths.srcDir, dirPath)}`);
}

/**
 * Generate code for validating types defined in a schema
 */
function generateValidatorCode(
  typesFile: string,
  schemaFile: string,
  codeFile: string,
  types: string[]
): string {
  const context = path.dirname(codeFile);

  const schemaPath = resolveRequire(context, schemaFile);
  const typesPath = resolveRequire(context, typesFile, '.ts');
  const validatorsPath = resolveRequire(context, `${paths.validatorsDir}.ts`, '.ts');

  let lines = [
    `import * as Types from '${typesPath}';`,
    `import schema from '${schemaPath}';`,
    `import { validate } from '${validatorsPath}';`,
    '',
    'type Schema = typeof schema;',
    'type Definition = keyof Schema[\'definitions\'];',
    '',
    'function conformToSchema<T>(',
    '  schema: Schema,',
    '  definition: Definition,',
    '  data: unknown',
    '): T {',
    '  return validate(schema, definition, data);',
    '}'
  ];

  types.forEach(function(type) {
    lines = lines.concat([
      '',
      `export function validate${type}(data: unknown): Types.${type} {`,
      `  return conformToSchema(schema, '${type}', data);`,
      '}'
    ]);
  });

  return lines.join('\n');
}

runAsScript(generateValidators, { stderr: process.stderr });
