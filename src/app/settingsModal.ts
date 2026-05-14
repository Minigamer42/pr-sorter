import type { DomRefs } from "./dom";
import type { Region, Settings } from "./types";

type BindSettingsModalOptions = {
  refs: DomRefs;
  getSettings(): Settings;
  onChange(settings: Settings): void;
};

type BoundSettingsModal = {
  sync(): void;
};

function isRegion(value: unknown): value is Region {
  return value === "eu" || value === "naw" || value === "nae";
}

export function bindSettingsModal(options: BindSettingsModalOptions): BoundSettingsModal {
  const { refs, getSettings, onChange } = options;

  function openSettings(): void {
    refs.settingsModal.style.display = "block";
    refs.modalOverlay.style.display = "block";
  }

  function closeSettings(): void {
    refs.settingsModal.style.display = "none";
    refs.modalOverlay.style.display = "none";
  }

  function sync(): void {
    const settings = getSettings();
    for (const button of refs.settingsOptionButtons) {
      if (button.dataset.type === "format") {
        button.classList.toggle("active", button.dataset.value === (settings.preferVideo ? "video" : "audio"));
      }

      if (button.dataset.type === "region") {
        button.classList.toggle("active", button.dataset.value === settings.region);
      }
    }
  }

  refs.settingsButton.addEventListener("click", openSettings);
  refs.closeSettingsButton.addEventListener("click", closeSettings);
  refs.modalOverlay.addEventListener("click", closeSettings);

  refs.settingsOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const settings = getSettings();
      if (button.dataset.type === "format") {
        onChange({ ...settings, preferVideo: button.dataset.value !== "audio" });
      }

      if (button.dataset.type === "region" && isRegion(button.dataset.value)) {
        onChange({ ...settings, region: button.dataset.value });
      }
    });
  });

  return { sync };
}
