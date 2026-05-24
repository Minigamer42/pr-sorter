import type { ReactElement } from "react";
import type { MediaFormat, Settings } from "../app/types";
import type { Song } from "../songs";
import { mediaType, normalizeAmqUrl, urlExtension, youtubeEmbedUrl } from "./internal/urls";

type MediaField = "video" | "mp3" | "full";

const mediaPriorities: Record<MediaFormat, MediaField[]> = {
  video: ["video", "mp3", "full"],
  audio: ["mp3", "video", "full"],
  full: ["full", "video", "mp3"],
};

export function Media({ song, settings }: { song: Song; settings: Settings }): ReactElement {
  if (!song.video && !song.mp3 && !song.full) {
    return <div>Media not available</div>;
  }

  for (const field of mediaPriorities[settings.mediaFormat]) {
    const url = song[field];
    if (!url) {
      continue;
    }

    const media = renderMedia(url, song, settings);
    if (media !== null) {
      return media;
    }
  }

  return <div>Media not available</div>;
}

function renderMedia(url: string, song: Song, settings: Settings): ReactElement | null {
  const youtubeUrl = youtubeEmbedUrl(url);
  if (youtubeUrl !== null) {
    return <iframe src={youtubeUrl} allowFullScreen title={`${song.name} video`} />;
  }

  const extension = urlExtension(url);
  if (extension === ".webm" || extension === ".mp4") {
    const src = normalizeAmqUrl(url, settings);
    return (
      <video controls>
        <source src={src} type={mediaType(src, "video/webm")} />
      </video>
    );
  }

  if (extension === ".mp3") {
    const src = normalizeAmqUrl(url, settings);
    return (
      <audio controls title={`${song.name} audio`}>
        <source src={src} type={mediaType(src, "audio/mp3")} />
      </audio>
    );
  }

  return null;
}
