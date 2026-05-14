import type { ReactElement } from "react";
import type { Settings } from "../app/types";
import type { Song } from "../songs";
import { mediaType, normalizeAmqUrl, youtubeEmbedUrl } from "./internal/urls";

export function Media({ song, settings }: { song: Song; settings: Settings }): ReactElement {
  if (!song.video && !song.mp3) {
    return <div>Video and MP3 not available</div>;
  }

  if (song.video && (settings.preferVideo || song.mp3 === null)) {
    const youtubeUrl = youtubeEmbedUrl(song.video);
    if (youtubeUrl !== null) {
      return <iframe src={youtubeUrl} allowFullScreen title={`${song.name} video`} />;
    }

    if (song.video.endsWith(".webm") || song.video.endsWith(".mp4")) {
      const src = normalizeAmqUrl(song.video, settings);
      return (
        <video controls>
          <source src={src} type={mediaType(src, "video/webm")} />
        </video>
      );
    }

    return <div>Video not available</div>;
  }

  if (song.mp3) {
    const src = normalizeAmqUrl(song.mp3, settings);
    return (
      <audio controls>
        <source src={src} type={mediaType(src, "audio/mp3")} />
      </audio>
    );
  }

  return <div>MP3 not available</div>;
}
