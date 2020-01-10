import { defineSchema, ExtractSchemaType, T } from '../validation';

export const ConfigurationSchema = defineSchema<{
  ignoreShelves?: string[];
  mergeShelves?: {
    group: string;
    members: string[];
  }[];
}>('configuration', T.object({
  ignoreShelves: T.array(T.string()),
  mergeShelves: T.array(T.object({
    group: T.string(),
    members: T.array(T.string())
  }))
}, [
  'ignoreShelves',
  'mergeShelves'
]));

export type Configuration = Required<ExtractSchemaType<typeof ConfigurationSchema>>;
