/**
 * Error class for Weavz API errors
 */
export class WeavzError extends Error {
  /** Machine-readable error code */
  readonly code: string
  /** HTTP status code */
  readonly status: number
  /** Additional error details */
  readonly details?: unknown

  constructor(options: { message: string; code: string; status: number; details?: unknown }) {
    super(options.message)
    this.name = 'WeavzError'
    this.code = options.code
    this.status = options.status
    this.details = options.details
  }
}
