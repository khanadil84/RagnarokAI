/**
 * Minimal Web Speech API declarations.
 *
 * TypeScript's lib.dom.d.ts already ships SpeechRecognitionResultList,
 * SpeechRecognitionResult and SpeechRecognitionAlternative, but not the
 * SpeechRecognition interface itself, the vendor-prefixed constructor or the
 * event types, so they are declared here.
 */

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognition

declare var SpeechRecognition: SpeechRecognitionCtor
declare var webkitSpeechRecognition: SpeechRecognitionCtor

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface Window {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}
