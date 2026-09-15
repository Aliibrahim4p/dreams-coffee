class StagingStorageException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingStorageException";
  }
}
export default StagingStorageException;
