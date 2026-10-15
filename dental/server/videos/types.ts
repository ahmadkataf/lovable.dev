// The video course on the website (/videos, /videos/<slug>, /en/videos, /en/videos/<slug>): one chapter per area of
// the app, in the order of the user guide, recorded by store/scripts/video/make.mjs (docs/VIDEOS.md is the contract).
// The chapter list lives in index.ts; the recorded files and manifest.json in site/videos/ (published, not committed).

export interface Bi { ar: string; en: string }

/** One chapter = one video per language. */
export interface VideoChapter {
  /** URL part (/videos/<slug>), the chapter script's name and the file names (<lang>/<slug>.mp4). */
  slug: string
  /** Position in the course, from 1. */
  order: number
  /** The guide topic the chapter is written from: "read this in the guide" goes to /guide/<guide>. */
  guide: string
  title: Bi
  /** One or two sentences: the card on the course home, the chapter page's lead and its meta description. */
  summary: Bi
}

/** One narrated scene of a recorded chapter: where it starts (seconds) and what the voice says. */
export interface VideoScene {
  id: string
  start: number
  text: string
}

/** What the recorder knows about one recorded file (manifest.json, key "<lang>/<slug>"). */
export interface VideoRecord {
  durationSeconds: number
  sizeBytes: number
  width: number
  height: number
  /** Of the .mp4; the pages add it to the file URLs (?v=), so a re-recorded chapter is never served from a stale cache. */
  sha256: string
  scenes: VideoScene[]
  /** ISO date or instant of the recording (schema.org uploadDate); older manifests have none. */
  recordedAt?: string
}

/** site/videos/manifest.json: the recorded files by "<lang>/<slug>". A chapter not recorded yet is simply absent. */
export type VideoManifest = Record<string, VideoRecord>

export type VideoLang = keyof Bi

/** The manifest key of a chapter in a language. */
export const videoKey = (lang: VideoLang, slug: string) => `${lang}/${slug}`
