import type { Settings } from "../../app/types";

export function normalizeAmqUrl(url: string, settings: Settings): string {
  if (!url.includes("animemusicquiz")) {
    return url;
  }

  const fileName = url.split("/").pop();
  return fileName ? `https://${settings.region}dist.animemusicquiz.com/${fileName}` : url;
}

export function mediaType(url: string, fallback: string): string {
  const extension = urlExtension(url);
  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".webm") {
    return "video/webm";
  }

  if (extension === ".mp3") {
    return "audio/mp3";
  }

  return fallback;
}

export function urlExtension(url: string): string {
  const path = urlPath(url).toLowerCase();
  const dotIndex = path.lastIndexOf(".");
  return dotIndex === -1 ? "" : path.slice(dotIndex);
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/, 1)[0];
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (parsed.hostname.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}
