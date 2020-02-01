export interface Configuration {
  ignoreAuthors: string[];
  ignoreShelves: string[];
  mergePublishers: { [group: string]: string[]; };
  mergeShelves: { [group: string]: string[]; };
  shelfPercentile: number;
}

export type UserConfiguration = Partial<Configuration>;
