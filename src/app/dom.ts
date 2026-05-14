export type DomRefs = {
  title: HTMLElement;
  startButton: HTMLButtonElement;
  loadButton: HTMLButtonElement;
  buttonContainer: HTMLElement;
  duelContainer: HTMLElement;
  progress: HTMLElement;
  progressContainer: HTMLElement;
  progressBattle: HTMLElement;
  progressBar: HTMLElement;
  cardTemplate: HTMLTemplateElement;
  settingsModal: HTMLElement;
  modalOverlay: HTMLElement;
  settingsButton: HTMLButtonElement;
  closeSettingsButton: HTMLButtonElement;
  settingsOptionButtons: NodeListOf<HTMLButtonElement>;
};

export function bindDom(): DomRefs {
  return {
    title: document.querySelector<HTMLElement>(".title")!,
    startButton: document.querySelector<HTMLButtonElement>("#start")!,
    loadButton: document.querySelector<HTMLButtonElement>("#load")!,
    buttonContainer: document.querySelector<HTMLElement>(".button-container")!,
    duelContainer: document.querySelector<HTMLElement>("#duel")!,
    progress: document.querySelector<HTMLElement>(".progress")!,
    progressContainer: document.querySelector<HTMLElement>(".progress-container")!,
    progressBattle: document.querySelector<HTMLElement>(".progressbattle")!,
    progressBar: document.querySelector<HTMLElement>("#progressBar")!,
    cardTemplate: document.querySelector<HTMLTemplateElement>("#song-card-template")!,
    settingsModal: document.querySelector<HTMLElement>("#settingsModal")!,
    modalOverlay: document.querySelector<HTMLElement>("#modalOverlay")!,
    settingsButton: document.querySelector<HTMLButtonElement>("#settings")!,
    closeSettingsButton: document.querySelector<HTMLButtonElement>("#close-settings")!,
    settingsOptionButtons: document.querySelectorAll<HTMLButtonElement>(".option-button[data-type]"),
  };
}
