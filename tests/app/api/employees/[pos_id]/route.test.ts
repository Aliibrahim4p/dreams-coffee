jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/employee-service");

import { NextRequest } from "next/server";
import { EmployeeService } from "@/services/employee-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { GET, PATCH, DELETE } from "@/app/api/employees/[pos_id]/route";

const MockedEmployeeService = EmployeeService as jest.Mocked<typeof EmployeeService>;

function makeParams(pos_id: string) {
  return { params: Promise.resolve({ pos_id }) };
}

describe("GET /api/employees/[pos_id]", () => {
  it("returns 200 with the employee", async () => {
    MockedEmployeeService.getEmployee.mockResolvedValue({
      pos_id: 101,
      first_name: "Jane",
      last_name: "Doe",
      is_active: true,
    });

    const req = new NextRequest("http://localhost/api/employees/101");
    const res = await GET(req, makeParams("101"));

    expect(res.status).toBe(200);
    expect(MockedEmployeeService.getEmployee).toHaveBeenCalledWith(101);
  });

  it("returns 404 when the employee does not exist", async () => {
    MockedEmployeeService.getEmployee.mockRejectedValue(new NotFoundException("Employee not found"));

    const req = new NextRequest("http://localhost/api/employees/999");
    const res = await GET(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric pos_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/employees/abc");
    const res = await GET(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedEmployeeService.getEmployee).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/employees/[pos_id]", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/employees/101", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("returns 200 with the updated employee", async () => {
    MockedEmployeeService.updateEmployee.mockResolvedValue({
      pos_id: 101,
      first_name: "Janet",
      last_name: "Doe",
      is_active: true,
    });

    const res = await PATCH(makeRequest({ first_name: "Janet" }), makeParams("101"));

    expect(res.status).toBe(200);
  });

  it("returns 400 when body has no fields", async () => {
    const res = await PATCH(makeRequest({}), makeParams("101"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/employees/101", {
      method: "PATCH",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req, makeParams("101"));

    expect(res.status).toBe(400);
    expect(MockedEmployeeService.updateEmployee).not.toHaveBeenCalled();
  });

  it("returns 404 when the employee does not exist", async () => {
    MockedEmployeeService.updateEmployee.mockRejectedValue(new NotFoundException("Employee not found"));

    const res = await PATCH(makeRequest({ first_name: "Janet" }), makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric pos_id without calling the service", async () => {
    const res = await PATCH(makeRequest({ first_name: "Janet" }), makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedEmployeeService.updateEmployee).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/employees/[pos_id]", () => {
  it("returns 204 on successful deactivation", async () => {
    MockedEmployeeService.deactivateEmployee.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/employees/101", { method: "DELETE" });
    const res = await DELETE(req, makeParams("101"));

    expect(res.status).toBe(204);
  });

  it("returns 404 when the employee does not exist", async () => {
    MockedEmployeeService.deactivateEmployee.mockRejectedValue(new NotFoundException("Employee not found"));

    const req = new NextRequest("http://localhost/api/employees/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric pos_id without calling the service", async () => {
    const req = new NextRequest("http://localhost/api/employees/abc", { method: "DELETE" });
    const res = await DELETE(req, makeParams("abc"));

    expect(res.status).toBe(400);
    expect(MockedEmployeeService.deactivateEmployee).not.toHaveBeenCalled();
  });
});
