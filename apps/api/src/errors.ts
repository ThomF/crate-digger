// Services throw these; the error handler plugin turns them into JSON responses.
// Services never touch `reply` — they just say what went wrong.
export class HttpError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
export const badRequest = (message: string) => new HttpError(400, message)
