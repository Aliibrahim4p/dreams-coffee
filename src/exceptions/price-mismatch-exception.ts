class PriceMismatchException extends Error {
  product_id: number;
  modifier_id: number | null;
  expected: number;
  actual: number;

  constructor(product_id: number, modifier_id: number | null, expected: number, actual: number) {
    super(
      `Price mismatch for product_id=${product_id} modifier_id=${modifier_id ?? "null"}: catalog price=${expected}, received=${actual}`,
    );
    this.name = "PriceMismatchException";
    this.product_id = product_id;
    this.modifier_id = modifier_id;
    this.expected = expected;
    this.actual = actual;
  }
}
export default PriceMismatchException;
