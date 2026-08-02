import BadRequestException from "@/exceptions/bad-request-exception";
import { parseIdParam } from "@/lib/parse-id-param";

describe("parseIdParam", () => {
  it("parses a valid integer string", () => {
    expect(parseIdParam("42", "product_id")).toBe(42);
  });

  it("parses a negative integer string", () => {
    expect(parseIdParam("-1", "product_id")).toBe(-1);
  });

  it("throws BadRequestException for non-numeric input", () => {
    expect(() => parseIdParam("abc", "product_id")).toThrow(BadRequestException);
  });

  it("throws BadRequestException for decimal input", () => {
    expect(() => parseIdParam("1.5", "product_id")).toThrow(BadRequestException);
  });

  it("throws BadRequestException for an empty string", () => {
    expect(() => parseIdParam("", "product_id")).toThrow(BadRequestException);
  });

  it("includes the label in the error message", () => {
    expect(() => parseIdParam("abc", "product_id")).toThrow("Invalid product_id");
  });
});
