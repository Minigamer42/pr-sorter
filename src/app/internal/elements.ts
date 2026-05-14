export function createButton(id: string, className: string, text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = id;
  button.classList.add(className);
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}
