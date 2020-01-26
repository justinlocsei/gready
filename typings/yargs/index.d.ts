import { Argv } from 'yargs';

declare module 'yargs' {
  interface Argv<T> {
    showHelp(handleText: (text: string) => void): Argv<T>;
  }
}
