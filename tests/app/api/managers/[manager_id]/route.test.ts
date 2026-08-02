jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/manager-service");

import { NextRequest } from "next/server";
import { ManagerService } from "@/services/manager-service";
import NotFoundException from "@/exceptions/not-found-exception";
import UniqueException from "@/exceptions/unique-exception";
import { GET, PATCH, DELETE } from "@/app/api/managers/[manager_id]/route";

const MockedManagerService = ManagerService as jest.Mocked<typeof ManagerService>;

function makeParams(manager_id: string) {
  return { params: Promise.resolve({ manager_id }) };
}

const managerRow = {
  manager_id: 1,
  username: "jdoe",
  first_name: "Jane",
  last_name: "Doe",
  is_active: true,
  created_at: new Date(),
};

describe("GET /api/managers/[manager_id]", () => {
  it("returns 200 with the manager", async () => {
    MockedManagerService.getManager.mockResolvedValue(managerRow);

    const req = new NextRequest("http://localhost/api/managers/1");
    const res = await GET(req, makeParams("1"));

    expect(res.status).toBe(200);
  });

  it("returns 404 when the manager does not exist", async () => {
    MockedManagerService.getManager.mockRejectedValue(new NotFoundException("Manager not found"));

    const req = new NextRequest("http://localhost/api/managers/999");
    const res = await GET(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric manager_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/managers/abc");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedManagerService.getManager).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/managers/[manager_id]", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/managers/1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 200 with the updated manager", async () => {
    MockedManagerService.updateManager.mockResolvedValue(managerRow);

    const res = await PATCH(makeRequest({ first_name: "Janet" }), makeParams("1"));

    expect(res.status).toBe(200);
  });

  it("returns 400 when body has no fields", async () => {
    const res = await PATCH(makeRequest({}), makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/managers/1", {
      method: "PATCH",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeParams("1"));

    expect(res.status).toBe(400);
    expect(MockedManagerService.updateManager).not.toHaveBeenCalled();
  });

  it("returns 409 when the new username is taken", async () => {
    MockedManagerService.updateManager.mockRejectedValue(new UniqueException("Username already taken"));

    const res = await PATCH(makeRequest({ username: "taken" }), makeParams("1"));

    expect(res.status).toBe(409);
  });

  it("returns 400 for a non-numeric manager_id without calling the service", async () => {
    const res = await PATCH(makeRequest({ first_name: "Janet" }), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedManagerService.updateManager).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/managers/[manager_id]", () => {
  it("returns 204 on successful deactivation", async () => {
    MockedManagerService.deactivateManager.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/managers/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));

    expect(res.status).toBe(204);
  });

  it("returns 404 when the manager does not exist", async () => {
    MockedManagerService.deactivateManager.mockRejectedValue(new NotFoundException("Manager not found"));

    const req = new NextRequest("http://localhost/api/managers/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric manager_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/managers/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedManagerService.deactivateManager).not.toHaveBeenCalled();
  });
});
