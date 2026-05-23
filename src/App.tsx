import { jsPDF } from 'jspdf'
import { useEffect, useMemo, useState } from 'react'
import bank from './data/questionBank.json'

type Mode = 'exam' | 'practice' | 'topic'
type Strategy = 'random' | 'balanced'

type QuestionOption = {
  key: 'A' | 'B' | 'C'
  text: string
}

type Question = {
  id: string
  topic: number
  prompt: string
  options: QuestionOption[]
  correctKey: 'A' | 'B' | 'C'
  explanation: string
  source: {
    topic: number
    sentence: string
  }
}

type QuestionBank = {
  totalQuestions: number
  questions: Question[]
}

const questionBank = bank as QuestionBank

function shuffle<T>(list: T[]) {
  const clone = [...list]
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = clone[i]
    clone[i] = clone[j]
    clone[j] = tmp
  }
  return clone
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function orderedOptions(question: Question) {
  return [...question.options].sort((left, right) => left.key.localeCompare(right.key))
}

function App() {
  const topics = useMemo(
    () => Array.from(new Set(questionBank.questions.map((q) => q.topic))).sort((a, b) => a - b),
    [],
  )

  const [mode, setMode] = useState<Mode>('exam')
  const [strategy, setStrategy] = useState<Strategy>('balanced')
  const [examMinutes, setExamMinutes] = useState(45)
  const [examStarted, setExamStarted] = useState(false)
  const [examQuestions, setExamQuestions] = useState<Question[]>([])
  const [examAnswers, setExamAnswers] = useState<Record<string, 'A' | 'B' | 'C'>>({})
  const [examIndex, setExamIndex] = useState(0)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(45 * 60)
  const [frozenPdfSet, setFrozenPdfSet] = useState<Question[]>([])

  const [practicePool, setPracticePool] = useState<Question[]>([])
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceSelected, setPracticeSelected] = useState<'A' | 'B' | 'C' | null>(null)
  const [practiceChecked, setPracticeChecked] = useState(false)
  const [topicFilter, setTopicFilter] = useState<number>(topics[0] ?? 1)

  const examCorrect = useMemo(() => {
    if (!examSubmitted) return 0
    return examQuestions.reduce((acc, question) => {
      return acc + (examAnswers[question.id] === question.correctKey ? 1 : 0)
    }, 0)
  }, [examAnswers, examQuestions, examSubmitted])

  useEffect(() => {
    if (mode !== 'exam' || !examStarted || examSubmitted || examQuestions.length === 0) return
    if (remainingSeconds <= 0) {
      setExamSubmitted(true)
      return
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => prev - 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [examQuestions.length, examStarted, examSubmitted, mode, remainingSeconds])

  function buildExamSet(nextStrategy: Strategy) {
    if (nextStrategy === 'random') {
      return shuffle(questionBank.questions).slice(0, 30)
    }

    const perTopic = Math.floor(30 / topics.length)
    const remainder = 30 % topics.length
    const chosen: Question[] = []

    for (let i = 0; i < topics.length; i += 1) {
      const topic = topics[i]
      const source = shuffle(questionBank.questions.filter((q) => q.topic === topic))
      const quota = perTopic + (i < remainder ? 1 : 0)
      chosen.push(...source.slice(0, quota))
    }

    return shuffle(chosen).slice(0, 30)
  }

  function startExam(nextStrategy = strategy) {
    const chosen = buildExamSet(nextStrategy)
    setMode('exam')
    setExamStarted(true)
    setExamQuestions(chosen)
    setFrozenPdfSet(chosen)
    setExamAnswers({})
    setExamSubmitted(false)
    setExamIndex(0)
    setRemainingSeconds(Math.max(1, examMinutes) * 60)
  }

  function resetExam() {
    setExamStarted(false)
    setExamQuestions([])
    setExamAnswers({})
    setExamSubmitted(false)
    setExamIndex(0)
    setRemainingSeconds(Math.max(1, examMinutes) * 60)
  }

  function selectAnswer(questionId: string, key: 'A' | 'B' | 'C') {
    if (examSubmitted) return
    setExamAnswers((prev) => ({ ...prev, [questionId]: key }))
  }

  function setupPractice(pool: Question[]) {
    const shuffled = shuffle(pool)
    setPracticePool(shuffled)
    setPracticeIndex(0)
    setPracticeSelected(null)
    setPracticeChecked(false)
  }

  function startPractice() {
    setupPractice(questionBank.questions)
  }

  function startTopicPractice() {
    setupPractice(questionBank.questions.filter((q) => q.topic === topicFilter))
  }

  function currentPracticeQuestion() {
    return practicePool[practiceIndex]
  }

  function submitPracticeAnswer() {
    if (!practiceSelected) return
    setPracticeChecked(true)
  }

  function nextPracticeQuestion() {
    if (practicePool.length === 0) return
    const next = (practiceIndex + 1) % practicePool.length
    setPracticeIndex(next)
    setPracticeSelected(null)
    setPracticeChecked(false)
  }

  function exportPdfQuestions() {
    const selected = frozenPdfSet.length ? frozenPdfSet : buildExamSet(strategy)
    if (!frozenPdfSet.length) {
      setFrozenPdfSet(selected)
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const marginX = 44
    const contentWidth = 515
    let y = 52

    const pushLines = (text: string, size = 11, spacing = 14) => {
      doc.setFontSize(size)
      const lines = doc.splitTextToSize(text, contentWidth)
      if (y + lines.length * spacing > 780) {
        doc.addPage()
        y = 52
      }
      doc.text(lines, marginX, y)
      y += lines.length * spacing + 4
    }

    pushLines('CardHelper - Test de Psicologia', 16, 18)
    pushLines('Version solo preguntas', 11, 14)
    pushLines(`Total preguntas: ${selected.length}`, 11, 14)
    y += 4

    selected.forEach((question, index) => {
      pushLines(`${index + 1}. ${question.prompt}`, 11, 14)
      orderedOptions(question).forEach((option) => {
        pushLines(`${option.key}) ${option.text}`, 10, 13)
      })

      y += 4
    })

    doc.save('test-solo-preguntas.pdf')
  }

  const activeExamQuestion = examQuestions[examIndex]
  const activePractice = currentPracticeQuestion()

  const tabClass = (tab: Mode) =>
    mode === tab
      ? 'rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white shadow-sm shadow-cyan-700/20 transition hover:bg-cyan-400'
      : 'rounded-xl border border-cyan-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50'

  const selectedExamOption = activeExamQuestion ? examAnswers[activeExamQuestion.id] : undefined

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.24),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(103,232,249,0.34),transparent_40%),linear-gradient(180deg,#dffcff,#f3feff_40%,#edfcff)] px-4 py-6 text-slate-800">
      <main className="mx-auto w-full max-w-6xl">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">CardHelper Psicologia</h1>
          <p className="mt-2 text-lg text-slate-700">Entrenador tipo test basado exclusivamente en tus apuntes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-300 bg-cyan-100/80 px-4 py-2 text-base font-medium text-cyan-900">
            Banco: {questionBank.totalQuestions} preguntas
          </span>
          <span className="rounded-full border border-cyan-300 bg-cyan-100/80 px-4 py-2 text-base font-medium text-cyan-900">
            Temas: {topics.length}
          </span>
        </div>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-cyan-200/80 bg-white/80 p-2 backdrop-blur-sm">
        <button className={tabClass('exam')} onClick={() => setMode('exam')}>Modo Examen</button>
        <button className={tabClass('practice')} onClick={() => { setMode('practice'); if (!practicePool.length) startPractice() }}>Practica inmediata</button>
        <button className={tabClass('topic')} onClick={() => setMode('topic')}>Practica por tema</button>
      </nav>

      <section className="rounded-3xl border border-cyan-200 bg-white/90 p-5 shadow-lg shadow-cyan-900/10 md:p-6">
        {mode === 'exam' && !examStarted && (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Configuracion del examen</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Estrategia</span>
                <select
                  className="w-full rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-300"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as Strategy)}
                >
                  <option value="balanced">Balanceada por temas</option>
                  <option value="random">Aleatoria global</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Temporizador (minutos)</span>
                <input
                  className="w-full rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-300"
                  type="number"
                  min={1}
                  max={240}
                  value={examMinutes}
                  onChange={(e) => setExamMinutes(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-cyan-400 active:translate-y-0"
                onClick={() => startExam()}
              >
                Empezar examen (30 preguntas)
              </button>
              <button
                className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 font-semibold text-slate-800 transition hover:bg-cyan-100"
                onClick={exportPdfQuestions}
              >
                Descargar PDF solo preguntas
              </button>
            </div>
          </div>
        )}

        {mode === 'exam' && examStarted && activeExamQuestion && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold text-slate-900">Simulacro examen</h2>
              <div className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 font-bold text-cyan-900">Tiempo: {formatSeconds(remainingSeconds)}</div>
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-sm font-medium text-slate-700">
              Pregunta {examIndex + 1} de {examQuestions.length} • Tema {activeExamQuestion.topic}
            </div>

            <article className="space-y-3 rounded-2xl border border-cyan-200 bg-white p-4">
              <h3 className="text-lg font-semibold leading-relaxed text-slate-900">{activeExamQuestion.prompt}</h3>
              <div className="grid gap-2">
                {orderedOptions(activeExamQuestion).map((option) => {
                  const selected = selectedExamOption === option.key
                  const isCorrect = examSubmitted && option.key === activeExamQuestion.correctKey
                  const isWrong = examSubmitted && selected && !isCorrect

                  const baseClass = 'w-full rounded-xl border px-3 py-2 text-left transition'
                  const styleClass = isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : isWrong
                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                      : selected
                        ? 'border-cyan-500 bg-cyan-100'
                        : 'border-cyan-200 bg-white hover:border-cyan-400 hover:bg-cyan-50'

                  return (
                    <button
                      key={option.key}
                      className={`${baseClass} ${styleClass}`}
                      onClick={() => selectAnswer(activeExamQuestion.id, option.key)}
                    >
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                        {option.key}
                      </span>
                      {option.text}
                    </button>
                  )
                })}
              </div>
            </article>

            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-cyan-300 bg-white px-4 py-2 font-semibold hover:bg-cyan-50" onClick={() => setExamIndex((i) => Math.max(0, i - 1))}>Anterior</button>
              <button className="rounded-xl border border-cyan-300 bg-white px-4 py-2 font-semibold hover:bg-cyan-50" onClick={() => setExamIndex((i) => Math.min(examQuestions.length - 1, i + 1))}>Siguiente</button>
              <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white hover:bg-cyan-400" onClick={() => setExamSubmitted(true)}>Entregar</button>
              <button className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200" onClick={resetExam}>Reiniciar</button>
            </div>

            {examSubmitted && (
              <section className="space-y-3 border-t border-cyan-200 pt-4">
                <h3 className="text-xl font-bold text-slate-900">Resultado: {examCorrect}/{examQuestions.length}</h3>
                {examQuestions.map((question, index) => {
                  const selected = examAnswers[question.id]
                  const correct = selected === question.correctKey
                  return (
                    <article
                      key={question.id}
                      className={`rounded-xl border p-3 ${correct ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}
                    >
                      <p className="font-semibold">
                        {index + 1}. Tema {question.topic} • {correct ? 'Correcta' : 'Incorrecta'}
                      </p>
                      <p className="text-sm">Tu respuesta: {selected ?? 'Sin responder'} • Correcta: {question.correctKey}</p>
                      <p className="mt-1 text-sm text-slate-700">{question.explanation}</p>
                    </article>
                  )
                })}
              </section>
            )}
          </div>
        )}

        {mode === 'practice' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold text-slate-900">Practica inmediata</h2>
              <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white hover:bg-cyan-400" onClick={startPractice}>Nueva pregunta</button>
            </div>

            {activePractice && (
              <>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-sm font-medium text-slate-700">
                  Tema {activePractice.topic} • {practiceIndex + 1}/{practicePool.length}
                </div>
                <article className="space-y-3 rounded-2xl border border-cyan-200 bg-white p-4">
                  <h3 className="text-lg font-semibold leading-relaxed text-slate-900">{activePractice.prompt}</h3>
                  <div className="grid gap-2">
                    {orderedOptions(activePractice).map((option) => {
                      const isSelected = practiceSelected === option.key
                      const isCorrect = practiceChecked && option.key === activePractice.correctKey
                      const isWrong = practiceChecked && isSelected && option.key !== activePractice.correctKey

                      const style = isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-900'
                          : isSelected
                            ? 'border-cyan-500 bg-cyan-100'
                            : 'border-cyan-200 bg-white hover:border-cyan-400 hover:bg-cyan-50'

                      return (
                        <button
                          key={option.key}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${style}`}
                          onClick={() => !practiceChecked && setPracticeSelected(option.key)}
                        >
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{option.key}</span>
                          {option.text}
                        </button>
                      )
                    })}
                  </div>
                </article>

                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!practiceSelected || practiceChecked} onClick={submitPracticeAnswer}>Comprobar</button>
                  <button className="rounded-xl border border-cyan-300 bg-white px-4 py-2 font-semibold hover:bg-cyan-50" onClick={nextPracticeQuestion}>Siguiente</button>
                </div>

                {practiceChecked && (
                  <section className={`rounded-xl border p-3 ${practiceSelected === activePractice.correctKey ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                    <p className="font-semibold">
                      {practiceSelected === activePractice.correctKey ? 'Correcta' : 'Incorrecta'} • Correcta: {activePractice.correctKey}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{activePractice.explanation}</p>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {mode === 'topic' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Practica por tema</h2>

            <div className="flex flex-wrap gap-2">
              <label className="min-w-56 flex-1 space-y-2">
                <span className="text-sm font-semibold text-slate-700">Tema</span>
                <select
                  className="w-full rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-300"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(Number(e.target.value))}
                >
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>Tema {topic}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white hover:bg-cyan-400" onClick={startTopicPractice}>Cargar preguntas del tema</button>
              </div>
            </div>

            {activePractice && (
              <>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-sm font-medium text-slate-700">
                  Tema {activePractice.topic} • {practiceIndex + 1}/{practicePool.length}
                </div>
                <article className="space-y-3 rounded-2xl border border-cyan-200 bg-white p-4">
                  <h3 className="text-lg font-semibold leading-relaxed text-slate-900">{activePractice.prompt}</h3>
                  <div className="grid gap-2">
                    {orderedOptions(activePractice).map((option) => {
                      const isSelected = practiceSelected === option.key
                      const isCorrect = practiceChecked && option.key === activePractice.correctKey
                      const isWrong = practiceChecked && isSelected && option.key !== activePractice.correctKey

                      const style = isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-900'
                          : isSelected
                            ? 'border-cyan-500 bg-cyan-100'
                            : 'border-cyan-200 bg-white hover:border-cyan-400 hover:bg-cyan-50'

                      return (
                        <button
                          key={option.key}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${style}`}
                          onClick={() => !practiceChecked && setPracticeSelected(option.key)}
                        >
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{option.key}</span>
                          {option.text}
                        </button>
                      )
                    })}
                  </div>
                </article>

                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!practiceSelected || practiceChecked} onClick={submitPracticeAnswer}>Comprobar</button>
                  <button className="rounded-xl border border-cyan-300 bg-white px-4 py-2 font-semibold hover:bg-cyan-50" onClick={nextPracticeQuestion}>Siguiente</button>
                </div>

                {practiceChecked && (
                  <section className={`rounded-xl border p-3 ${practiceSelected === activePractice.correctKey ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                    <p className="font-semibold">
                      {practiceSelected === activePractice.correctKey ? 'Correcta' : 'Incorrecta'} • Correcta: {activePractice.correctKey}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{activePractice.explanation}</p>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </section>
      </main>
    </div>
  )
}

export default App
