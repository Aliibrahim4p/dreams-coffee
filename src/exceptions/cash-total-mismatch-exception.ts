class CashTotalMismatchException extends Error {
  order_id: string;
  expected: number;
  actual: number;

  constructor(order_id: string, expected: number, actual: number) {
    super(
      `Cash mismatch for order ${order_id}: expected total_due=${expected}, got cash_tendered-change_given=${actual}`,
    );
    this.name = "CashTotalMismatchException";
    this.order_id = order_id;
    this.expected = expected;
    this.actual = actual;
  }
}
export default CashTotalMismatchException;
