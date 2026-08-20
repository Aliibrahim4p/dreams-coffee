class SessionClosedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionClosedException";
  }
}
export default SessionClosedException;
