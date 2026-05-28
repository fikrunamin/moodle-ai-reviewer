export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APP_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
