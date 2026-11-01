import type { ErrorRequestHandler, RequestHandler } from "express"
import type { ApiError } from "@railradar/shared"

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "not_found", "Route not found"))
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError =
    err instanceof HttpError ? err : new HttpError(500, "internal_error", "Internal server error")
  if (httpError.status >= 500) console.error(err)
  const body: ApiError = {
    error: { code: httpError.code, message: httpError.message },
  }
  res.status(httpError.status).json(body)
}
