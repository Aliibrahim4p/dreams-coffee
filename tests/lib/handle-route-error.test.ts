import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { handleRouteError } from "@/lib/handle-route-error";

describe("handleRouteError", () => {
  it("maps UniqueException to 409", async () => {
    const res = handleRouteError(new UniqueException("name taken"));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "name taken" });
  });

  it("maps NotFoundException to 404", async () => {
    const res = handleRouteError(new NotFoundException("not found"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "not found" });
  });

  it("maps BadRequestException to 400", async () => {
    const res = handleRouteError(new BadRequestException("bad input"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad input" });
  });

  it("maps UnauthorizedException to 401", async () => {
    const res = handleRouteError(new UnauthorizedException("token expired"));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "token expired" });
  });

  it("maps unknown errors to 500 with a generic message", async () => {
    const res = handleRouteError(new Error("db exploded"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});
