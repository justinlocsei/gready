import chalk, { ForegroundColor } from 'chalk';

import { ExtractArrayType } from './types/util';
import { OutputHandler } from './types/system';

const LEVELS = [
  { rank: 0, name: 'none' },
  { rank: 1, name: 'warn' },
  { rank: 2, name: 'info' },
  { rank: 3, name: 'debug' }
] as const;

const LEVEL_NAMES = LEVELS.map(l => l.name);
const TIME_DIGITS = 4;

export const DEFAULT_LEVEL: LevelName = 'info';

export type LevelName = ExtractArrayType<typeof LEVEL_NAMES>;
export type LoggingMethod = 'debug' | 'info';

export interface LoggerOptions {
  logLevel?: LevelName;
  showTime?: boolean;
  useColor?: boolean;
}

/**
 * Get the names of all levels
 */
export function getLevelNames(): string[] {
  return LEVELS.map(l => l.name).sort();
}

class LoggerClass {

  readonly isEnabled: boolean;
  readonly level: LevelName;
  readonly showTime: boolean;
  readonly useColor: boolean;

  private handleMessage: OutputHandler;
  private indentation: number;
  private lastTime: number;

  /**
   * Create a new logger
   */
  constructor(handleMessage: OutputHandler, options: LoggerOptions = {}) {
    this.handleMessage = handleMessage;
    this.indentation = 0;
    this.lastTime = 0;
    this.level = options.logLevel || DEFAULT_LEVEL;
    this.showTime = options.showTime === undefined ? false : options.showTime;
    this.useColor = options.useColor === undefined ? true : options.useColor;

    this.isEnabled = this.level !== 'none';
  }

  /**
   * Log a debug message
   */
  debug(...message: string[]) {
    this.logMessage('debug', message, 'green');
  }

  /**
   * Increase the logger's indentation
   */
  indent(spaces: number) {
    this.indentation += spaces;
  }

  /**
   * Log an info message
   */
  info(...message: string[]) {
    this.logMessage('info', message);
  }

  /**
   * Log a message using a named method
   */
  log(method: LoggingMethod, message: string[]) {
    this[method](...message);
  }

  /**
   * Decrease the logger's indentation
   */
  outdent(spaces: number) {
    this.indentation -= spaces;
  }

  /**
   * Log a warning
   */
  warn(...message: string[]) {
    this.logMessage('warn', message, 'yellow');
  }

  /**
   * Log a message
   */
  private logMessage(
    levelName: LevelName,
    parts: string[],
    color?: typeof ForegroundColor
  ) {
    const currentRank = this.getLevelRank(this.level);
    const targetRank = this.getLevelRank(levelName);

    if (currentRank < targetRank) {
      return;
    }

    const levelNames = LEVELS
      .filter(l => l.rank && l.rank <= currentRank)
      .map(l => l.name);

    const longestLabel = Math.max(...levelNames.map(n => n.length));
    const label = levelName.toUpperCase().padEnd(longestLabel);

    let message = `[${label}] ${' '.repeat(this.indentation)}${parts.join(' | ')}`;

    if (this.useColor && color) {
      message = chalk[color](message);
    }

    if (this.showTime) {
      const time = this.formatElapsedTime();
      message = `${this.useColor ? chalk.white(time) : time} ${message}`;
    }

    this.handleMessage(message);
  }

  /**
   * Get the rank for a named level
   */
  private getLevelRank(name: LevelName): number {
    return LEVELS.filter(l => l.name === name)[0].rank;
  }

  /**
   * Format the time elapsed since the last log statement
   */
  private formatElapsedTime(): string {
    const current = Date.now();
    const time = this.lastTime ? current - this.lastTime : 0;

    this.lastTime = current;;

    return time.toString().padStart(TIME_DIGITS, ' ') + 'ms';
  }

}

export type Logger = InstanceType<typeof LoggerClass>;

/**
 * Create a logger
 */
export function createLogger(...args: ConstructorParameters<typeof LoggerClass>): Logger {
  return new LoggerClass(...args);
}
