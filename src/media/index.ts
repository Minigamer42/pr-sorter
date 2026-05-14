import type { Settings } from "../app/types";
import type { Song } from "../songs";
import { createSourceElement, unavailable } from "./internal/elements";
import { mediaType, normalizeAmqUrl, youtubeEmbedUrl } from "./internal/urls";

export function createMediaElement(song: Song, settings: Settings): HTMLElement {
  if (!song.video && !song.mp3) {
    return unavailable("Video and MP3 not available");
  }

  if (song.video && (settings.preferVideo || song.mp3 === null)) {
    const youtubeUrl = youtubeEmbedUrl(song.video);
    if (youtubeUrl !== null) {
      const iframe = document.createElement("iframe");
      iframe.src = youtubeUrl;
      iframe.allowFullscreen = true;
      iframe.title = `${song.name} video`;
      return iframe;
    }

    if (song.video.endsWith(".webm") || song.video.endsWith(".mp4")) {
      const src = normalizeAmqUrl(song.video, settings);
      const video = document.createElement("video");
      video.controls = true;
      video.appendChild(createSourceElement(src, mediaType(src, "video/webm")));
      return video;
    }

    return unavailable("Video not available");
  }

  if (song.mp3) {
    const src = normalizeAmqUrl(song.mp3, settings);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.appendChild(createSourceElement(src, mediaType(src, "audio/mp3")));
    return audio;
  }

  return unavailable("MP3 not available");
}
