import * as fs from 'fs/promises'

const sinsyFullContextLabelPattern = /^([0-9]+) [0-9]+ [a-z]+@[a-zA-Z]+\^[a-zA-Z]+\-([a-zA-Z]+)\+.+\/E:(xx|[A-G]b?[0-9])/
const timeCoefficient = 1.0e-7

const prefix = '../..'

const noteSteps = 'C_D_EF_G_A_B'

const parseNote = (note: string): number => {
  return note.split('').reduce((acc, val) => {
    // parse accidental
    if (val == 'b') {
      return acc - 1
    }

    const pos = noteSteps.indexOf(val)

    return pos === -1 ? acc + parseInt(val) * 12 : acc + pos
  }, 24)
}

const processLabel = (labels: string): string => {
  const labelEntries = labels.split('\n')
  const output: [number, string, number][] = []

  let lastPause = false

  for (const l of labelEntries) {
    if (!l) {
      continue
    }

    const parsed = l.match(sinsyFullContextLabelPattern)

    if (parsed === null) {
      console.log(l)
      throw new Error('failed to parse the label')
    }
    const [_, startTime, lyrics, note] = parsed

    if (startTime === undefined || lyrics === undefined || note === undefined) {
      throw new Error('failed to parse the label')
    }

    const timestamp = parseFloat(startTime) * timeCoefficient
    const noteNumber = note === 'xx' ? 0 : parseNote(note)
    const lyricsProcessed = lyrics === 'xx' || lyrics === 'sil' ? 'pau' : lyrics

    const isPause = lyricsProcessed === 'pau'

    if (isPause && lastPause) {
      continue
    }

    lastPause = isPause

    output.push([timestamp, lyricsProcessed, noteNumber])
  }

  return output.join('\n')
}

const main = async () => {
  for (let i = 1, total = 50; i <= total; ++i) {
    const idx = `${i}`.padStart(2, '0')
    const fullContextLabelPath = `${prefix}/mono_label_generated/${idx}.lab`
    const processedLabelPath = `${prefix}/mono_label_with_note/${idx}.txt`

    console.log(`${idx}/${total}`)

    const labelData = await fs.readFile(fullContextLabelPath, 'utf-8')
    const labels = processLabel(labelData)

    await fs.writeFile(processedLabelPath, labels)
  }
}

main()
