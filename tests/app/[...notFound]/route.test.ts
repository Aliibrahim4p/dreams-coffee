import { GET, POST, PUT, PATCH, DELETE } from "@/app/[...notFound]/route";

describe("catch-all route for unmatched paths", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ])("returns a JSON 404 for %s", async (_method, handler) => {
    const res = await handler();

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json).toEqual({ error: "Not Found" });
  });
});
