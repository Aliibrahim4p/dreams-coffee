import prisma from "@/lib/db";

const MANAGER_PIN_KEY = "manager_pin";

export class PanelRepository {
  async getManagerPinHash(): Promise<string | null> {
    const config = await prisma.appConfig.findUnique({ where: { config_key: MANAGER_PIN_KEY } });
    return config?.config_value ?? null;
  }
}
