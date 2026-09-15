class InvalidOrderTypeException extends Error {
  order_id: string;

  constructor(order_id: string, message: string) {
    super(message);
    this.name = "InvalidOrderTypeException";
    this.order_id = order_id;
  }
}
export default InvalidOrderTypeException;
