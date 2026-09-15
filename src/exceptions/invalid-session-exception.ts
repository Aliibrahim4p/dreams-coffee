class InvalidSessionException extends Error {
  session_id: string;

  constructor(session_id: string) {
    super(`session_id ${session_id} does not reference an open shift session`);
    this.name = "InvalidSessionException";
    this.session_id = session_id;
  }
}
export default InvalidSessionException;
