import * as TJS from 'typescript-json-schema';
import * as TS from 'typescript';
import path from 'path';

import { formatJSON } from './serialization';
import { OperationalError } from './errors';
import { paths, resolveRequire } from './environment';

interface ValidatorFile {
  content: string;
  path: string;
}

/**
 * Generate validator code for all exported types in a file
 */
export async function generateValidator(
  typesFile: string,
  targetDir: string
): Promise<{
  schema: ValidatorFile;
  validator: ValidatorFile;
}> {
  const program = TJS.getProgramFromFiles([typesFile]);

  const generator = TJS.buildGenerator(program, {
    ref: false,
    required: true
  });

  if (!generator) {
    throw new OperationalError(`Could not parse types in file: ${typesFile}`);
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

  const schemaFile = path.join(targetDir, 'schema.json');
  const codeFile = path.join(targetDir, 'index.ts');

  return {
    schema: {
      content: formatJSON(generator.getSchemaForSymbols(symbols)),
      path: schemaFile
    },
    validator: {
      content: generateValidatorCode(typesFile, schemaFile, codeFile, symbols),
      path: codeFile
    }
  };
}

/**
 * Generate code for validating types defined in a schema
 */
function generateValidatorCode(
  typesFile: string,
  schemaFile: string,
  codeFile: string,
  typeNames: string[]
): string {
  const context = path.dirname(codeFile);

  const schemaPath = resolveRequire(context, schemaFile);
  const typesPath = resolveRequire(context, typesFile, '.ts');
  const validatorsPath = resolveRequire(context, paths.validationFile, '.ts');

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

  typeNames.forEach(function(typeName) {
    lines = lines.concat([
      '',
      `export function validate${typeName}(data: unknown): Types.${typeName} {`,
      `  return conformToSchema(schema, '${typeName}', data);`,
      '}'
    ]);
  });

  return lines.join('\n');
}
