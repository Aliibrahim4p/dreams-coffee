import { verifyAdminSecret } from "@/lib/verify-admin-secret";
import { signAdminToken } from "@/lib/admin-jwt";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { AdminLogin } from "@/types/admin-login";
import logger from "@/util/logger";

const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;

export class AdminAuthService {
  static async login(data: AdminLogin) {
    if (!verifyAdminSecret(data.admin_key)) {
      throw new UnauthorizedException("Incorrect admin key");
    }

    const { token, expiresAt } = signAdminToken(ADMIN_TOKEN_TTL_SECONDS);
    logger.info("Admin login succeeded");

    return {
      admin_token: token,
      expires_at: expiresAt,
    };
  }
}
