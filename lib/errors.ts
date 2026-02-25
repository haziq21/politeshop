export class UnexpectedResponseError extends Error {
  response?: Response;

  constructor(
    message: string,
    options?: ErrorOptions & { response?: Response },
  ) {
    super(message, options);
    this.name = "UnexpectedResponseError";
    this.response = options?.response;
  }
}
