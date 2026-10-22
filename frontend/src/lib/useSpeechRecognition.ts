import { useCallback, useEffect, useRef, useState } from 'react'

export interface DictationOptions {
  /**
   * Called once with the full accumulated session text when recognition ends
   * naturally (complete final command). NOT called on manual stop/abort —
   * that is what enables safe hands-free auto-dispatch.
   */
  onComplete?: (fullText: string) => void
}

export interface DictationControls {
  supported: boolean
  listening: boolean
  error: string | null
  start: (base: string) => void
  stop: () => void
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed':
    'Microphone permission was denied. Allow microphone access for this site and try again.',
  'service-not-allowed':
    'The browser blocked speech recognition. Check this site’s microphone permission.',
  network: 'Speech recognition hit a network error.',
  'no-speech': 'No speech was detected.',
  'audio-capture': 'No microphone was detected.',
  aborted: 'Speech recognition was aborted.',
}

/** Join a snapshot base with a recognized transcript, trimming and collapsing whitespace. */
export function joinDictation(base: string, transcript: string): string {
  const words = transcript.trim().replace(/\s+/g, ' ')
  if (!words) return base
  if (!base.trim()) return words
  const separated = base.endsWith(' ') || base.endsWith('\n') ? base : `${base} `
  return `${separated}${words}`
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}

/**
 * Browser-native dictation. Recognition runs client-side; the caller decides
 * where the resulting text goes (the Incident Lab writes it through the same
 * controlled textarea state used for typing and system-level dictation).
 */
export function useSpeechRecognition(
  onText: (text: string) => void,
  options?: DictationOptions,
): DictationControls {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseRef = useRef('')
  const transcriptRef = useRef('')
  const writtenRef = useRef('')
  const onTextRef = useRef(onText)
  const onCompleteRef = useRef(options?.onComplete)
  /** True when the session is being ended deliberately (stop/abort/unmount). */
  const deliberateEndRef = useRef(false)

  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  useEffect(() => {
    onCompleteRef.current = options?.onComplete
  }, [options?.onComplete])

  const commit = useCallback(() => {
    const next = joinDictation(baseRef.current, transcriptRef.current).slice(0, 500)
    // Idempotent: identical text is never written twice, so repeated
    // onresult events cannot append the same transcript more than once.
    if (next === writtenRef.current) return
    writtenRef.current = next
    onTextRef.current(next)
  }, [])

  const stop = useCallback(() => {
    deliberateEndRef.current = true
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(
    (base: string) => {
      const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (!Ctor) return
      if (recognitionRef.current) {
        deliberateEndRef.current = true
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
      let recognition: SpeechRecognition
      try {
        recognition = new Ctor()
      } catch {
        setError('Speech recognition could not be started.')
        return
      }

      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = navigator.language || 'en-US'

      baseRef.current = base
      transcriptRef.current = ''
      writtenRef.current = joinDictation(base, '').slice(0, 500)

      recognition.onresult = (event) => {
        let text = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (!result?.isFinal) continue
          text += result[0]?.transcript ?? ''
        }
        if (!text) return
        transcriptRef.current += text
        commit()
      }

      recognition.onerror = (event) => {
        setError(
          ERROR_MESSAGES[event.error] ?? `Speech recognition failed (${event.error}).`,
        )
      }

      recognition.onend = () => {
        recognitionRef.current = null
        setListening(false)
        commit()
        const natural = !deliberateEndRef.current
        deliberateEndRef.current = false
        if (!natural) return
        const fullText = joinDictation(baseRef.current, transcriptRef.current)
          .slice(0, 500)
          .trim()
        if (fullText) onCompleteRef.current?.(fullText)
      }

      try {
        recognition.start()
      } catch {
        setError('Speech recognition could not be started.')
        return
      }

      deliberateEndRef.current = false
      recognitionRef.current = recognition
      setListening(true)
      setError(null)
    },
    [commit],
  )

  useEffect(() => {
    return () => {
      deliberateEndRef.current = true
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  return {
    supported: isSpeechRecognitionSupported(),
    listening,
    error,
    start,
    stop,
  }
}
