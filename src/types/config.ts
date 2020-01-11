import { defineSchema, ExtractSchemaType, T } from '../validation';

export const ConfigurationSchema = defineSchema<{
  ignoreShelves?: string[];
  mergePublishers?: Record<string, string[]>;
  mergeShelves?: Record<string, string[]>;
}>('configuration', T.object({
  ignoreShelves: T.array(T.string()),
  mergePublishers: T.object({}, [], T.array(T.string())),
  mergeShelves: T.object({}, [], T.array(T.string()))
}, [
  'ignoreShelves',
  'mergePublishers',
  'mergeShelves'
]));

export type Configuration = Required<ExtractSchemaType<typeof ConfigurationSchema>>;
