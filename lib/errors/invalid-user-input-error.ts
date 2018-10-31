export class InvalidUserInputError extends Error {
  public code = 422;
  public name = 'InvalidUserInputError';

  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, InvalidUserInputError);
  }
}
