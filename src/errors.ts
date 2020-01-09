export class CLIError extends Error {

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, CLIError.prototype);
  }

}

export class OperationalError extends Error {

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, OperationalError.prototype);
  }

}
