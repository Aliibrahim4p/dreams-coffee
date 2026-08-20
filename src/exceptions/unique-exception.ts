class UniqueException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueException";
  }
}
export default UniqueException;
