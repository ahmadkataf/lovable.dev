// Splitting reading texts the same way for the audio generator and the player,
// so the highlight can follow the recording sentence by sentence.

export function splitSentences(text: string): string[] {
  const out: string[] = []
  const re = /[^.!?]+(?:[.!?]+["')\]]*|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = m[0].trim()
    if (!s) continue
    // keep an abbreviation or an initial attached to the sentence it belongs to
    const prev = out[out.length - 1]
    if (prev && /\b(Mr|Mrs|Ms|Dr|St|No|vs|etc|e\.g|i\.e)\.$/i.test(prev)) out[out.length - 1] = `${prev} ${s}`
    else out.push(s)
  }
  return out.length ? out : [text.trim()].filter(Boolean)
}
