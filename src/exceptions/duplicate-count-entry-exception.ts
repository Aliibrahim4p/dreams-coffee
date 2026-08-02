class DuplicateCountEntryException extends Error {
  count_id: string;

  constructor(message: string, count_id: string) {
    super(message);
    this.name = "DuplicateCountEntryException";
    this.count_id = count_id;
  }
}
export default DuplicateCountEntryException;
