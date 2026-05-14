export function unavailable(message: string): HTMLElement {
  const element = document.createElement("div");
  element.textContent = message;
  return element;
}

export function createSourceElement(src: string, type: string): HTMLSourceElement {
  const source = document.createElement("source");
  source.src = src;
  source.type = type;
  return source;
}
