import { NextResponse } from "next/server";
import { ZodType } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export function validateBody<T>(schema: ZodType<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: result.error.issues
            .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
            .join(", "),
        },
        { status: 400 },
      ),
    };
  }
  return { success: true, data: result.data };
}
