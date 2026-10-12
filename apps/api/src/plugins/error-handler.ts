import { STATUS_CODES } from 'node:http'
import fp from 'fastify-plugin'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import type { ApiError } from '@crate-digger/shared'
import { HttpError } from '../errors.ts'

function body(statusCode: number, message: string, issues?: ApiError['issues']): ApiError {
  return { statusCode, error: STATUS_CODES[statusCode] ?? 'Error', message, issues }
}

// Every error leaves the API in the same { statusCode, error, message, issues? } shape.
export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, req, reply) => {
    // 1. The request didn't match its Zod schema → 400 with one issue per bad field.
    if (hasZodFastifySchemaValidationErrors(err)) {
      const issues = err.validation.map((v) => ({
        path: `${err.validationContext ?? 'request'}${v.instancePath}`,
        message: v.message ?? 'Invalid value',
      }))
      return reply.code(400).send(body(400, 'Request is invalid', issues))
    }

    // 2. Our own response didn't match its schema → a bug on our side. Log it, hide details.
    if (isResponseSerializationError(err)) {
      req.log.error({ err, issues: err.cause.issues }, 'response failed schema validation')
      return reply.code(500).send(body(500, 'Something went wrong'))
    }

    // 3. A service said "not found", "bad request", etc.
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send(body(err.statusCode, err.message))
    }

    // 4. Fastify's own client errors (malformed JSON, body too large, ...).
    const status = (err as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500) {
      return reply
        .code(status)
        .send(body(status, err instanceof Error ? err.message : 'Bad request'))
    }

    // 5. Anything else is unexpected.
    req.log.error(err)
    return reply.code(500).send(body(500, 'Something went wrong'))
  })
})
