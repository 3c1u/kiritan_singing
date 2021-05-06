import * as fs from 'fs/promises'

const sinsyFullContextLabelPattern = /^([0-9]+) ([0-9]+) [a-z]+@[a-zA-Z]+\^[a-zA-Z]+\-([a-zA-Z]+)\+.+\/E:(xx|[A-G]b?[0-9])/
const timeCoefficient = 1.0e-7

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
  let compansation = 0

  for (const l of labelEntries) {
    if (!l) {
      continue
    }

    const parsed = l.match(sinsyFullContextLabelPattern)

    if (parsed === null) {
      console.log(l)
      throw new Error('failed to parse the label')
    }
    const [_, startTime, endTime, lyrics, note] = parsed

    if (endTime === undefined || lyrics === undefined || note === undefined) {
      throw new Error('failed to parse the label')
    }

    const timestamp = (parseFloat(endTime) - parseFloat(startTime)) * timeCoefficient
    const noteNumber = note === 'xx' ? 0 : parseNote(note)
    const lyricsProcessed = lyrics === 'xx' || lyrics === 'sil' || lyrics === 'pau' ? '<X>' : lyrics

    const isPause = lyricsProcessed === 'pau'

    if (isPause && lastPause) {
      continue
    }

    let deltaTime = Math.floor((timestamp - compansation) * 1000)

    if (deltaTime <= 2) {
      compansation = 2
      deltaTime = 2
    } else {
      compansation = 0
    }
  
    output.push([deltaTime, lyricsProcessed, noteNumber])
  }

  return 'Duration\tText\tNote\n' + output.map(l => l.join('\t')).join('\n')
}

const main = async () => {
  const fullContextLabelPath = process.argv[2]
  const processedLabelPath = process.argv[3]

  if (!processedLabelPath || !processedLabelPath) {
    console.error('Insufficient arguments')
    return
  }

  console.log(`${fullContextLabelPath} -> ${processedLabelPath}`)

  const labelData = await fs.readFile(fullContextLabelPath, 'utf-8')
  const labels = processLabel(labelData)

  await fs.writeFile(processedLabelPath, labels)
}

main()
