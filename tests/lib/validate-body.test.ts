import z from "zod";
import { validateBody } from "@/lib/validate-body";

const schema = z.object({ name: z.string().min(1) });

describe("validateBody", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateBody(schema, { name: "Coffee" });
    expect(result).toEqual({ success: true, data: { name: "Coffee" } });
  });

  it("returns a 400 response with a joined issue message for invalid input", async () => {
    const result = validateBody(schema, { name: "" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.response.status).toBe(400);
    const body = await result.response.json();
    expect(body.error).toContain("name");
  });

  it("returns a 400 response when a required field is missing", async () => {
    const result = validateBody(schema, {});
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.response.status).toBe(400);
  });

  it("omits the leading path prefix for object-level refine issues with no path", async () => {
    const refineSchema = z
      .object({ a: z.string().optional(), b: z.string().optional() })
      .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
      });

    const result = validateBody(refineSchema, {});
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    const body = await result.response.json();
    expect(body.error).toBe("At least one field is required");
  });
});
