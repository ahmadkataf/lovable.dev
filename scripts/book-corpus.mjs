// Builds the set of sentences a student may legitimately be shown as an example:
// the book's own prose, plus its exercise sentences with the printed gap or
// bracketed choice resolved. The vocabulary tables in the extraction were written
// by the extractor rather than the book, so they are never evidence.

export const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const GAP = /(?:…|\.{3,}|_{3,}|-{3,})+/g
const CHOICE = /\(([^()]*?[-,][^()]*?)\)/g

function variants(line) {
  // "3- The company apologized for the late ......... of the train. → **arrival**"
  const answers = [...line.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1].trim())
  let body = line.replace(/→.*$/, '').replace(/\*\*/g, '').trim()
  body = body.replace(/^\s*(?:[-*]|\d+[-.)]|[a-d][-.)])\s*/, '')
  const out = [body]
  if (GAP.test(body)) {
    GAP.lastIndex = 0
    for (const a of answers) out.push(body.replace(GAP, a))
  }
  const choices = [...body.matchAll(CHOICE)]
  if (choices.length === 1) {
    for (const opt of choices[0][1].split(/[-,]/)) {
      const o = opt.trim()
      if (o) out.push(body.replace(choices[0][0], o))
    }
  }
  return out
}

// "1- Bullying is ......... problem." followed by "a- a complex  b- an easy" is one
// exercise: the sentence a student may be shown is the stem with an option in the gap.
const OPTION_LINE = /^\s*(?:[a-d]\s*[-.)]|Answer:)/i
function optionsFrom(lines, i) {
  const opts = []
  for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
    const l = lines[j].replace(/\*\*/g, '').trim()
    if (!OPTION_LINE.test(l)) break
    for (const part of l.split(/\s{2,}|\s(?=[a-d]\s*[-.)]\s)/)) {
      const m = part.match(/^\s*(?:Answer:\s*)?[a-d]\s*[-.)]\s*(.+?)\s*$/i)
      if (m) opts.push(m[1].replace(/\.$/, '').trim())
    }
  }
  return opts
}

// Some texts number their glossed words in the running text ("the child's 3aptitude", "to 1 accomplish").
// Those digits are exercise references, not words of the sentence.
export const stripGlossNumbers = md => md
  .replace(/(^|[\s(“"'‘])\d(?=[a-z])(?!(?:st|nd|rd|th)\b)/gm, '$1')
  .replace(/([a-z,]) \d (?=[a-z])/g, '$1 ')

export function bookCorpus(md) {
  md = stripGlossNumbers(md)
  // page markers and bare page numbers sit in the middle of sentences that run across pages
  const lines = md.split('\n')
    .filter(l => (l.match(/\|/g) || []).length < 3)
    .filter(l => !/^## Page \d+\s*$/.test(l) && !/^\s*\d{1,3}\s*$/.test(l))
  const parts = []
  for (let i = 0; i < lines.length; i++) {
    parts.push(...variants(lines[i]))
    GAP.lastIndex = 0
    if (GAP.test(lines[i])) {
      const stem = lines[i].replace(/→.*$/, '').replace(/\*\*/g, '').replace(/^\s*(?:[-*]|\d+[-.)]|[a-d][-.)])\s*/, '').trim()
      for (const o of optionsFrom(lines, i)) {
        GAP.lastIndex = 0
        parts.push(stem.replace(GAP, ` ${o} `))
      }
    }
  }
  return norm(parts.join(' \n '))
}
