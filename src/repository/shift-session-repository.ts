import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentBusinessDateTime } from "@/lib/business-date";
import NotFoundException from "@/exceptions/not-found-exception";
import UniqueException from "@/exceptions/unique-exception";
import { OpenShiftSession } from "@/types/shift-session";
import logger from "@/util/logger";

type SessionWithCashier = {
  session_id: string;
  cashier_pos_id: number;
  starting_float: Prisma.Decimal;
  start_time: Date;
  end_time: Date | null;
  live_cash_total: Prisma.Decimal;
  cashier: { first_name: string; last_name: string };
};

// NFR-011: exactly 2 concurrent terminals, each with its own session_id/session_token.
const MAX_CONCURRENT_TERMINAL_SESSIONS = 2;

function mapSession(session: SessionWithCashier) {
  return {
    session_id: session.session_id,
    cashier_pos_id: session.cashier_pos_id,
    cashier_name: `${session.cashier.first_name} ${session.cashier.last_name}`,
    starting_float: Number(session.starting_float),
    start_time: session.start_time,
    end_time: session.end_time,
    live_cash_total: Number(session.live_cash_total),
  };
}

export class ShiftSessionRepository {
  async openSession(data: OpenShiftSession) {
    const employee = await prisma.employee.findUnique({ where: { pos_id: data.cashier_pos_id } });
    if (!employee || !employee.is_active) {
      throw new NotFoundException("cashier_pos_id does not match any active employee");
    }

    // Up to MAX_CONCURRENT_TERMINAL_SESSIONS may be open at once — one per terminal
    // (NFR-011). There's no per-device column to scope this by, so it's a headcount
    // of open sessions system-wide, not an identity check against a specific terminal.
    const openSessionCount = await prisma.shiftSession.count({ where: { end_time: null } });
    if (openSessionCount >= MAX_CONCURRENT_TERMINAL_SESSIONS) {
      throw new UniqueException("Maximum number of concurrent terminal sessions already open");
    }

    try {
      const session = await prisma.shiftSession.create({
        data: {
          cashier_pos_id: data.cashier_pos_id,
          starting_float: data.starting_float,
          start_time: getCurrentBusinessDateTime(),
          // the float that was just put in the drawer is the starting live cash total
          live_cash_total: data.starting_float,
        },
        include: { cashier: true },
      });
      return mapSession(session);
    } catch (error) {
      logger.error("Failed to open shift session cashier_pos_id=%d: %s", data.cashier_pos_id, error);
      throw error;
    }
  }

  async cashOut(sessionId: string) {
    const session = await prisma.shiftSession.findUnique({ where: { session_id: sessionId } });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    if (session.end_time !== null) {
      throw new UniqueException("Session already closed");
    }

    const openOrder = await prisma.order.findFirst({ where: { session_id: sessionId, status: "open" } });
    if (openOrder) {
      throw new UniqueException("An order is still open — finish or clear the basket first");
    }

    try {
      const grossSales = await prisma.order.aggregate({
        where: { session_id: sessionId, status: "completed" },
        _sum: { total_due: true },
      });

      const closed = await prisma.shiftSession.update({
        where: { session_id: sessionId },
        data: { end_time: getCurrentBusinessDateTime() },
        include: { cashier: true },
      });

      return {
        ...mapSession(closed),
        // computed from completed orders at response time, never stored — refunds are
        // negative orders, so they net out of the same sum
        gross_sales: Number(grossSales._sum.total_due ?? 0),
      };
    } catch (error) {
      logger.error("Failed to cash out session_id=%s: %s", sessionId, error);
      throw error;
    }
  }

  /**
   * Recovery path: cash out whatever session is currently open, without needing its
   * session_token — for when a device's stored token is lost. Only unambiguous when
   * exactly one session is open; with a second terminal's session also open (NFR-011),
   * "current" no longer identifies a single session, so this refuses rather than
   * guessing — use the by-id cash-out route instead. Panel-token-gated; see proxy.ts.
   */
  async cashOutCurrent() {
    const openSessions = await prisma.shiftSession.findMany({
      where: { end_time: null },
      take: MAX_CONCURRENT_TERMINAL_SESSIONS + 1,
      select: { session_id: true },
    });
    if (openSessions.length === 0) {
      throw new NotFoundException("No open session on this terminal");
    }
    if (openSessions.length > 1) {
      throw new UniqueException("Multiple sessions are open — use the by-id cash-out route instead");
    }
    return this.cashOut(openSessions[0].session_id);
  }

  async isOpenSession(sessionId: string): Promise<boolean> {
    const session = await prisma.shiftSession.findUnique({
      where: { session_id: sessionId },
      select: { end_time: true },
    });
    return session !== null && session.end_time === null;
  }
}
