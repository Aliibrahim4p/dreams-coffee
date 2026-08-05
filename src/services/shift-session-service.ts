import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { signSessionToken } from "@/lib/session-jwt";
import { OpenShiftSession } from "@/types/shift-session";
import logger from "@/util/logger";

export class ShiftSessionService {
  static async openSession(data: OpenShiftSession) {
    const session = await new ShiftSessionRepository().openSession(data);
    const { token } = signSessionToken(session.session_id);
    logger.info("Shift session opened: id=%s cashier_pos_id=%d", session.session_id, data.cashier_pos_id);
    return {
      ...session,
      session_token: token,
      // client always fires the 24V drawer pulse on a successful open
      trigger_drawer_pulse: true,
    };
  }

  static async cashOut(sessionId: string) {
    const result = await new ShiftSessionRepository().cashOut(sessionId);
    logger.info("Shift session cashed out: id=%s gross_sales=%d", sessionId, result.gross_sales);
    return result;
  }

  static async cashOutCurrent() {
    const result = await new ShiftSessionRepository().cashOutCurrent();
    logger.info("Shift session cashed out (recovery): id=%s gross_sales=%d", result.session_id, result.gross_sales);
    return result;
  }
}
