export default class Stack<T> {
  private items: T[];
  private errorMessage: string;

  constructor(private readonly type: string = "stack") {
    this.items = [];
    this.errorMessage = `${type} used outside a valid context`;
  }

  push(item: T) {
    this.items.push(item);
  }

  pop(): T {
    if (this.isEmpty()) {
      throw new Error(this.errorMessage);
    }

    return this.items.pop()!;
  }

  peek(): T {
    if (this.isEmpty()) {
      throw new Error(this.errorMessage);
    }

    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear() {
    this.items = [];
  }
}
