export interface Configuration {
  ignoreAuthors: string[];
  ignoreShelves: string[];
  mergePublishers: { [group: string]: string[]; };
  mergeShelves: { [group: string]: string[]; };
}

export type UserConfiguration = Partial<Configuration>;
