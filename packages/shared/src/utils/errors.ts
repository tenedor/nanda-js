export class NotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(public readonly id: string) {
    super(`Conflict: ${id}`);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
