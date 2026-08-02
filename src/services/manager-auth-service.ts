import { ManagerRepository } from "@/repository/manager-repository";
import { verifyPassword } from "@/lib/password";
import { signManagerToken } from "@/lib/jwt";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { ManagerLogin } from "@/types/manager-login";
import logger from "@/util/logger";

const MANAGER_TOKEN_TTL_SECONDS = 8 * 60 * 60;

export class ManagerAuthService {
  static async login(data: ManagerLogin) {
    const manager = await new ManagerRepository().findByUsername(data.username);
    if (!manager || !manager.is_active) {
      logger.warn("Manager login failed: unknown or inactive username=%s", data.username);
      throw new UnauthorizedException("Incorrect username or password");
    }

    const passwordMatches = await verifyPassword(data.password, manager.password_hash);
    if (!passwordMatches) {
      logger.warn("Manager login failed: wrong password for username=%s", data.username);
      throw new UnauthorizedException("Incorrect username or password");
    }

    const { token, expiresAt } = signManagerToken(manager.manager_id, MANAGER_TOKEN_TTL_SECONDS);
    logger.info("Manager login succeeded: manager_id=%d username=%s", manager.manager_id, manager.username);

    return {
      manager_token: token,
      expires_at: expiresAt,
      manager: {
        manager_id: manager.manager_id,
        username: manager.username,
        first_name: manager.first_name,
        last_name: manager.last_name,
      },
    };
  }
}
