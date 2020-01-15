import Logger, { LoggingMethod } from './logger';

/**
 * Run a sequence of asynchronous tasks
 */
export async function runSequence<T, U>(
  label: string[],
  tasks: T[],
  logger: Logger,
  runTask: (task: T) => Promise<U>,
  logMethod: LoggingMethod = 'info'
): Promise<U[]> {
  const totalTasks = tasks.length;
  const results: U[] = [];

  const totalDigits = totalTasks.toString().length;
  const progressWidth = totalDigits * 2 + 2;

  let index = 0;
  let task: T;
  let result: U;

  logger.log(logMethod, [
    '='.repeat(progressWidth - 1) + ' ' + label[0],
    ...label.slice(1)
  ]);

  while (index < totalTasks) {
    task = tasks[index];
    index++;

    logger.log(logMethod, [
      index.toString().padStart(totalDigits) + '/' + totalTasks + ' ' + label[0],
      ...label.slice(1)
    ]);

    logger.indent(progressWidth);

    result = await runTask(task);

    logger.outdent(progressWidth);

    results.push(result);
  }

  return results;
}
