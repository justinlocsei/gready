export enum Levels {
  None = 0,
  Info = 1,
  Debug = 2
}

export type LevelName = 'debug' | 'info' | 'none'

export const LEVEL_NAMES: Record<Levels, LevelName> = {
  [Levels.Debug]: 'debug',
  [Levels.Info]: 'info',
  [Levels.None]: 'none'
} as const;

export const NAMED_LEVELS: Record<LevelName, Levels> = {
  debug: Levels.Debug,
  info: Levels.Info,
  none: Levels.None
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
   * Log a debug message
   */
  debug(message: string) {
    if (this.level >= Levels.Debug) {
      this.stdout.write(`${message}\n`);
    }
  }

  /**
   * Log an info message
   */
  info(message: string) {
    if (this.level >= Levels.Info) {
      this.stdout.write(`${message}\n`);
    }
  }

}
