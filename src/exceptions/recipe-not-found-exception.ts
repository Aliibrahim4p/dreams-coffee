class RecipeNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeNotFoundException";
  }
}
export default RecipeNotFoundException;
