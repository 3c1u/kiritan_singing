import * as fs from 'fs/promises'

const datasetPrefix = '../..'
const nonVoicedLabel = ['pau']

interface Label {
  startTime: number
  lyrics: string
  noteNumber?: number
  exactMatch?: boolean
}

const parseMonoLabels = (labels: string): Label[] => {
  return labels
    .split('\n')
    .filter(v => Boolean(v))
    .map(v => {
      const [start, , lyrics] = v.split(' ')
      const startTime = parseFloat(start)

      return {
        startTime,
        lyrics,
      }
    })
}

const parseMonoLabelsWithNote = (labels: string): Label[] => {
  return labels
    .split('\n')
    .filter(v => Boolean(v))
    .map(v => {
      const [start, lyrics, nn] = v.split(',')
      const startTime = parseFloat(start)
      const noteNumber = parseInt(nn)

      return {
        startTime,
        lyrics,
        noteNumber,
      }
    })
}

const matchLabels = async (id: number, prefix: string = datasetPrefix) => {
  const idPadded = `${id}`.padStart(2, '0')
  const monoLabelPath = `${prefix}/mono_label/${idPadded}.lab`
  const monoNoteLabelPath = `${prefix}/mono_label_with_note/${idPadded}.txt`

  const monoLabel = parseMonoLabels(await fs.readFile(monoLabelPath, 'utf-8'))
  const monoNoteLabel = parseMonoLabelsWithNote(
    await fs.readFile(monoNoteLabelPath, 'utf-8'),
  )

  const nMono = monoLabel.length
  const nNote = monoNoteLabel.length

  const dp = Array.from(Array(nMono + 1), _ =>
    Array.from(Array(nNote + 1), _ => Infinity),
  )

  for (let i = 0; i <= nMono; ++i) {
    dp[i][0] = 0
  }

  for (let j = 0; j <= nNote; ++j) {
    dp[0][j] = 0
  }

  for (let j = 0; j < nNote; ++j) {
    for (let i = 0; i < nMono; ++i) {
      const dmin = Math.min(dp[i][j + 1], dp[i + 1][j], dp[i][j])
      const d = monoLabel[i].lyrics === monoNoteLabel[j].lyrics ? 0 : 1

      dp[i + 1][j + 1] = d + dmin
    }
  }

  process.stdout.write('\n             ')
  process.stdout.write(monoNoteLabel.map(v => v.lyrics.padStart(4)).join(' '))
  process.stdout.write('\n')

  let y_note = nNote
  let x_mono = nMono

  while (y_note !== 0 && x_mono !== 0) {
    const dLeft = dp[x_mono - 1][y_note]
    const dBottom = dp[x_mono][y_note - 1]
    const dLeftBottom = dp[x_mono - 1][y_note - 1]

    if (dLeft < dBottom && dLeft < dLeftBottom) {
      if (monoLabel[x_mono - 1].noteNumber === undefined) {
        const label = monoLabel[x_mono - 1]
        const labelWithNote = monoNoteLabel[y_note - 1]
  
        label.noteNumber = labelWithNote.noteNumber
        label.exactMatch = labelWithNote.lyrics === label.lyrics
      }

      x_mono--
      continue
    }

    if (dBottom < dLeftBottom) {
      if (!monoLabel[x_mono - 1].exactMatch) {
        const label = monoLabel[x_mono - 1]
        const labelWithNote = monoNoteLabel[y_note - 1]
  
        label.noteNumber = labelWithNote.noteNumber
        label.exactMatch = labelWithNote.lyrics === label.lyrics
      }

      y_note--

      if (y_note === 0) {
        break
      }

      if (!monoLabel[x_mono - 1].exactMatch) {
        const label = monoLabel[x_mono - 1]
        const labelWithNote = monoNoteLabel[y_note - 1]
  
        label.noteNumber = labelWithNote.noteNumber
        label.exactMatch = labelWithNote.lyrics === label.lyrics
      }

      continue
    }

    if (!monoLabel[x_mono - 1].exactMatch) {
      const label = monoLabel[x_mono - 1]
      const labelWithNote = monoNoteLabel[y_note - 1]

      label.noteNumber = labelWithNote.noteNumber
      label.exactMatch = labelWithNote.lyrics === label.lyrics
    }

    x_mono--
    y_note--
  }

  // fill unknown note with zeros
  monoLabel.forEach(v => {
    if (nonVoicedLabel.includes(v.lyrics)) {
      v.noteNumber = 0
      return
    }

    v.noteNumber = v.noteNumber ?? 0
  })

  // for debug:
  for (let i = 0; i <= nMono; ++i) {
    const p = nMono - i
    const ly = p == 0 ? '' : monoLabel[p - 1].lyrics
    const nn = p == 0 ? '' : monoLabel[p - 1].noteNumber ?? '?'
    process.stdout.write(ly.padStart(4))
    process.stdout.write(`${nn}`.padStart(4))

    if (p) {
      process.stdout.write(dp[p].map(v => `${v}`.padStart(4)).join(' '))
    } else {
      process.stdout.write('     ')
      process.stdout.write(monoNoteLabel.map(v => `${v.noteNumber}`.padStart(4)).join(' '))
    }
  
    process.stdout.write('\n')
  }
}

const main = async () => {
  await matchLabels(0, './test')
}

main()
