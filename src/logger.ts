export enum Levels {
  None = 0,
  Info = 1,
  Verbose = 2
}

export type LevelName = 'info' | 'none' | 'verbose'

export const LEVEL_NAMES: Record<Levels, LevelName> = {
  [Levels.Info]: 'info',
  [Levels.None]: 'none',
  [Levels.Verbose]: 'verbose'
} as const;

export const NAMED_LEVELS: Record<LevelName, Levels> = {
  info: Levels.Info,
  none: Levels.None,
  verbose: Levels.Verbose
} as const;

export default class Logger {

  private level: Levels;
  private stderr: NodeJS.WritableStream;
  private stdout: NodeJS.WritableStream;
  private useColor: boolean;

  /**
   * Create a new logger
   */
  constructor(
    stdout: NodeJS.WritableStream,
    stderr: NodeJS.WritableStream,
    options: {
      logLevel: Levels;
      useColor: boolean;
    } = {
      logLevel: Levels.Info,
      useColor: true
    }
  ) {
    this.level = options.logLevel;
    this.stdout = stdout;
    this.stderr = stderr;
    this.useColor = options.useColor;
  }

  /**
   * Log an info message
   */
  info(message: string) {
    if (this.level >= Levels.Info) {
      this.stderr.write(`${message}\n`);
    }
  }

}
