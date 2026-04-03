import { create } from 'zustand'
import { createCurrentSeoulDateTimeText } from '../../../shared/utils/dateText'

interface AssessmentDraftState {
  clientId: number | null
  selectedScaleCodes: string[]
  currentScaleIndex: number
  answersByScale: Record<string, Record<number, string>>
  memo: string
  startedAt: string | null
  initialize: (clientId: number, scaleCodes: string[]) => void
  setAnswer: (scaleCode: string, questionNo: number, value: string) => void
  setMemo: (memo: string) => void
  nextScale: () => void
  previousScale: () => void
  reset: () => void
}

const initialState = {
  clientId: null,
  selectedScaleCodes: [],
  currentScaleIndex: 0,
  answersByScale: {},
  memo: '',
  startedAt: null,
}

export const useAssessmentDraftStore = create<AssessmentDraftState>((set) => ({
  ...initialState,
  initialize: (clientId, scaleCodes) =>
    set({
      clientId,
      selectedScaleCodes: scaleCodes,
      currentScaleIndex: 0,
      answersByScale: {},
      memo: '',
      startedAt: createCurrentSeoulDateTimeText(),
    }),
  setAnswer: (scaleCode, questionNo, value) =>
    set((state) => ({
      answersByScale: {
        ...state.answersByScale,
        [scaleCode]: {
          ...(state.answersByScale[scaleCode] ?? {}),
          [questionNo]: value,
        },
      },
    })),
  setMemo: (memo) => set({ memo }),
  nextScale: () => set((state) => ({ currentScaleIndex: Math.min(state.currentScaleIndex + 1, state.selectedScaleCodes.length - 1) })),
  previousScale: () => set((state) => ({ currentScaleIndex: Math.max(state.currentScaleIndex - 1, 0) })),
  reset: () => set(initialState),
}))
