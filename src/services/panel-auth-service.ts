import { PanelRepository } from "@/repository/panel-repository";
import { verifyPassword } from "@/lib/password";
import { issuePanelToken } from "@/lib/panel-secret";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { PanelPinVerify } from "@/types/panel-pin";

export class PanelAuthService {
  static async verifyPin(data: PanelPinVerify) {
    const hash = await new PanelRepository().getManagerPinHash();
    if (!hash || !(await verifyPassword(data.pin, hash))) {
      throw new UnauthorizedException("Incorrect PIN");
    }

    return { panel_token: issuePanelToken() };
  }
}
