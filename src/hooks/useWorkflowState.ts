import { useState, useEffect } from 'react'
import { Language, ReminderTone, LedgerEntry } from '@/types'

const WORKFLOW_STORAGE_KEY = 'khatamatch_workflow_state'

export interface UploadedLedgerInfo {
  name: string
  size: number
  type: string
  previewUrl: string
  storagePath?: string
  isSample?: boolean
  fileObj?: File
}

export interface UploadedStatementInfo {
  name: string
  size: number
  csvContent?: string
  isSample?: boolean
}

export interface WorkflowState {
  ledger: UploadedLedgerInfo | null
  statement: UploadedStatementInfo | null
  language: Language
  tone: ReminderTone
  step: number
  sampleLoaded: boolean
  extractedEntries: LedgerEntry[]
  pageQuality: 'good' | 'fair' | 'poor' | null
  extractionWarnings: string[]
}

const DEFAULT_STATE: WorkflowState = {
  ledger: null,
  statement: null,
  language: 'english',
  tone: 'polite',
  step: 1,
  sampleLoaded: false,
  extractedEntries: [],
  pageQuality: null,
  extractionWarnings: [],
}

export function useWorkflowState() {
  const [state, setState] = useState<WorkflowState>(() => {
    try {
      const saved = sessionStorage.getItem(WORKFLOW_STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_STATE
    } catch {
      return DEFAULT_STATE
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Unable to persist workflow state to sessionStorage', e)
    }
  }, [state])

  const setLedger = (ledger: UploadedLedgerInfo | null) => {
    setState((prev) => ({
      ...prev,
      ledger,
      sampleLoaded: ledger?.isSample ?? false,
      extractedEntries: ledger?.isSample ? prev.extractedEntries : [],
    }))
  }

  const setStatement = (statement: UploadedStatementInfo | null) => {
    setState((prev) => ({ ...prev, statement }))
  }

  const setLanguage = (language: Language) => {
    setState((prev) => ({ ...prev, language }))
  }

  const setTone = (tone: ReminderTone) => {
    setState((prev) => ({ ...prev, tone }))
  }

  const setExtractedData = (
    entries: LedgerEntry[],
    pageQuality: 'good' | 'fair' | 'poor' = 'good',
    warnings: string[] = []
  ) => {
    setState((prev) => ({
      ...prev,
      extractedEntries: entries,
      pageQuality,
      extractionWarnings: warnings,
    }))
  }

  const loadSampleData = async () => {
    const sampleLedger: UploadedLedgerInfo = {
      name: 'sample-ledger-udhaar.png',
      size: 48200,
      type: 'image/png',
      previewUrl: '/sample-data/sample-ledger.svg',
      isSample: true,
    }

    try {
      const response = await fetch('/sample-data/sample-statement.csv')
      const csvText = await response.text()
      const sampleStatement: UploadedStatementInfo = {
        name: 'sample-statement.csv',
        size: csvText.length,
        csvContent: csvText,
        isSample: true,
      }

      setState((prev) => ({
        ...prev,
        ledger: sampleLedger,
        statement: sampleStatement,
        language: 'english',
        tone: 'polite',
        sampleLoaded: true,
      }))
    } catch (e) {
      const defaultCsv = `date,payer_name,amount,reference\n2026-09-12,Murugan K,1250,UPI982347101\n2026-09-13,Lakshmi,500,UPI982347102\n2026-09-14,Ravi Kumar,2000,UPI982347103\n2026-09-15,Unknown Person,900,UPI982347104\n2026-09-16,Priya,300,UPI982347105\n2026-09-17,Suresh M,1500,UPI982347106`
      setState((prev) => ({
        ...prev,
        ledger: sampleLedger,
        statement: {
          name: 'sample-statement.csv',
          size: defaultCsv.length,
          csvContent: defaultCsv,
          isSample: true,
        },
        language: 'english',
        tone: 'polite',
        sampleLoaded: true,
      }))
    }
  }

  const resetWorkflow = () => {
    setState(DEFAULT_STATE)
    sessionStorage.removeItem(WORKFLOW_STORAGE_KEY)
  }

  return {
    state,
    setLedger,
    setStatement,
    setLanguage,
    setTone,
    setExtractedData,
    loadSampleData,
    resetWorkflow,
  }
}
