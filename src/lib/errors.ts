export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { code: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { code: "internal", message: "No se pudo completar la operación." },
    { status: 500 },
  );
}
