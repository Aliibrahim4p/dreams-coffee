jest.mock("@/repository/manager-repository");

import { ManagerRepository } from "@/repository/manager-repository";
import { ManagerService } from "@/services/manager-service";

const MockedManagerRepository = ManagerRepository as jest.MockedClass<typeof ManagerRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedManagerRepository.mockImplementation(() => overrides as unknown as ManagerRepository);
}

describe("ManagerService", () => {
  it("createManager delegates to the repository", async () => {
    const createManager = jest.fn().mockResolvedValue({ manager_id: 1 });
    mockRepo({ createManager });
    const data = { username: "jdoe", password: "x", first_name: "Jane", last_name: "Doe" };

    await ManagerService.createManager(data);

    expect(createManager).toHaveBeenCalledWith(data);
  });

  it("listManagers delegates to the repository", async () => {
    const listManagers = jest.fn().mockResolvedValue([]);
    mockRepo({ listManagers });

    await ManagerService.listManagers(true);

    expect(listManagers).toHaveBeenCalledWith(true);
  });

  it("getManager delegates to the repository", async () => {
    const getManager = jest.fn().mockResolvedValue({ manager_id: 1 });
    mockRepo({ getManager });

    await ManagerService.getManager(1);

    expect(getManager).toHaveBeenCalledWith(1);
  });

  it("updateManager delegates to the repository", async () => {
    const updateManager = jest.fn().mockResolvedValue({ manager_id: 1 });
    mockRepo({ updateManager });

    await ManagerService.updateManager(1, { first_name: "New" });

    expect(updateManager).toHaveBeenCalledWith(1, { first_name: "New" });
  });

  it("deactivateManager delegates to the repository", async () => {
    const deactivateManager = jest.fn().mockResolvedValue(undefined);
    mockRepo({ deactivateManager });

    await ManagerService.deactivateManager(1);

    expect(deactivateManager).toHaveBeenCalledWith(1);
  });
});
