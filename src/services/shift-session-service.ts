import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { signSessionToken } from "@/lib/session-jwt";
import { OpenShiftSession } from "@/types/shift-session";

const SESSION_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export class ShiftSessionService {
  static async openSession(data: OpenShiftSession) {
    const session = await new ShiftSessionRepository().openSession(data);
    const { token, expiresAt } = signSessionToken(session.session_id, SESSION_TOKEN_TTL_SECONDS);
    return {
      ...session,
      session_token: token,
      expires_at: expiresAt,
      // client always fires the 24V drawer pulse on a successful open
      trigger_drawer_pulse: true,
    };
  }

  static async cashOut(sessionId: string) {
    return new ShiftSessionRepository().cashOut(sessionId);
  }

  static async cashOutCurrent() {
    return new ShiftSessionRepository().cashOutCurrent();
  }
}
