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

export class NetworkError extends OperationalError {

  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, NetworkError.prototype);
  }

}
