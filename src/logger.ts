import chalk, { ForegroundColor } from 'chalk';

import { ExtractArrayType } from './types/core';

const LEVELS = [
  { rank: 0, name: 'none' },
  { rank: 1, name: 'info' },
  { rank: 2, name: 'debug' }
] as const;

const LEVEL_NAMES = LEVELS.map(l => l.name);

export const DEFAULT_LEVEL: LevelName = 'info';

export type LevelName = ExtractArrayType<typeof LEVEL_NAMES>;

/**
 * Get the names of all levels
 */
export function getLevelNames(): string[] {
  return LEVELS.map(l => l.name).sort();
}

export default class Logger {

  private level: LevelName;
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
      logLevel: LevelName;
      useColor: boolean;
    } = {
      logLevel: DEFAULT_LEVEL,
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
  debug(...message: string[]) {
    this.log(this.stderr, 'debug', message, 'green');
  }

  /**
   * Log an info message
   */
  info(...message: string[]) {
    this.log(this.stderr, 'info', message);
  }

  /**
   * Log a message
   */
  private log(
    stream: NodeJS.WritableStream,
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

    stream.write(message);
  }

  /**
   * Get the rank for a named level
   */
  private getLevelRank(name: LevelName): number {
    return LEVELS.filter(l => l.name === name)[0].rank;
  }

}
