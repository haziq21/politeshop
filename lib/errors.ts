export class HTTPError extends Error {
  status: number;

  constructor(status: number, url: string) {
    super(`Received ${status} for ${url}`);
    this.name = "HTTPError";
    this.status = status;
  }
}
