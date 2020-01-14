import chalk, { ForegroundColor } from 'chalk';

import { ExtractArrayType } from './types/util';

const LEVELS = [
  { rank: 0, name: 'none' },
  { rank: 1, name: 'info' },
  { rank: 2, name: 'debug' }
] as const;

const LEVEL_NAMES = LEVELS.map(l => l.name);
const TIME_DIGITS = 4;

export const DEFAULT_LEVEL: LevelName = 'info';

export type LevelName = ExtractArrayType<typeof LEVEL_NAMES>;

/**
 * Get the names of all levels
 */
export function getLevelNames(): string[] {
  return LEVELS.map(l => l.name).sort();
}

export default class Logger {

  private lastTime: number;
  private level: LevelName;
  private showTime: boolean;
  private stream: NodeJS.WritableStream;
  private useColor: boolean;

  /**
   * Create a new logger
   */
  constructor(
    stream: NodeJS.WritableStream,
    options: {
      logLevel: LevelName;
      showTime: boolean;
      useColor: boolean;
    } = {
      logLevel: DEFAULT_LEVEL,
      showTime: false,
      useColor: true
    }
  ) {
    this.lastTime = 0;
    this.level = options.logLevel;
    this.showTime = options.showTime;
    this.stream = stream;
    this.useColor = options.useColor;
  }

  /**
   * Log a debug message
   */
  debug(...message: string[]) {
    this.log('debug', message, 'green');
  }

  /**
   * Log an info message
   */
  info(...message: string[]) {
    this.log('info', message);
  }

  /**
   * Log a message
   */
  private log(
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
      .filter(l => l.rank <= currentRank)
      .map(l => l.name);

    if (!levelNames.length) {
      return;
    }

    const longestLabel = Math.max(...levelNames.map(n => n.length));
    const label = levelName.toUpperCase().padEnd(longestLabel);

    let message = `[${label}] ${parts.join(' | ')}\n`;

    if (this.useColor && color) {
      message = chalk[color](message);
    }

    if (this.showTime) {
      message = `${chalk.white(this.formatElapsedTime())} ${message}`;
    }

    this.stream.write(message);
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
