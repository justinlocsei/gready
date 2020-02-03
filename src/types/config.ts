export interface Configuration {
  ignoreAuthors: string[];
  ignoreShelves: string[];
  publisherAliases: { [group: string]: string[]; };
  shelfAliases: { [group: string]: string[]; };
  shelfPercentile: number;
}

export type UserConfiguration = Partial<Configuration>;
