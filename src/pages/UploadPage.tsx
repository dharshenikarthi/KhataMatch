import React, { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkflowState } from '@/hooks/useWorkflowState'
import { useAuth } from '@/hooks/useAuth'
import { ledgerExtractionService } from '@/services/ledgerExtractionService'
import { csvParserService } from '@/services/csvParserService'
import { paymentImportService } from '@/services/paymentImportService'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  Camera,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Languages,
  Volume2,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Language, ReminderTone } from '@/types'

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { state, setLedger, setStatement, setLanguage, setTone, setExtractedData, loadSampleData } = useWorkflowState()

  const [ledgerDragOver, setLedgerDragOver] = useState(false)
  const [statementDragOver, setStatementDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>('')

  const ledgerInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const statementInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15MB

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // --- LEDGER IMAGE HANDLERS ---
  const handleLedgerFile = (file: File) => {
    setErrorMessage(null)

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png)$/i)) {
      setErrorMessage('Please upload a valid image file (JPG, JPEG, or PNG).')
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Ledger image is too large. Please select an image under 15MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLedger({
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        previewUrl: dataUrl,
        fileObj: file,
        isSample: false,
      })
      setSuccessMessage('Ledger image attached successfully.')
      setTimeout(() => setSuccessMessage(null), 3500)
    }
    reader.onerror = () => {
      const previewUrl = URL.createObjectURL(file)
      setLedger({
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        previewUrl: previewUrl,
        fileObj: file,
        isSample: false,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleLedgerDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setLedgerDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLedgerFile(e.dataTransfer.files[0])
    }
  }

  const handleLedgerChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLedgerFile(e.target.files[0])
    }
  }

  const handleRemoveLedger = () => {
    setLedger(null)
    if (ledgerInputRef.current) ledgerInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // --- STATEMENT CSV HANDLERS ---
  const handleStatementFile = (file: File) => {
    setErrorMessage(null)

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setErrorMessage('Please upload a valid CSV file (.csv) for your UPI/bank statement.')
      return
    }

    if (file.size === 0) {
      setErrorMessage('The selected CSV file is empty. Please choose a valid statement export.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text || text.trim().length === 0) {
        setErrorMessage('Unable to read content from CSV file.')
        return
      }

      setStatement({
        name: file.name,
        size: file.size,
        csvContent: text,
        isSample: false,
      })
      setSuccessMessage('Bank / UPI statement attached successfully.')
      setTimeout(() => setSuccessMessage(null), 3500)
    }

    reader.onerror = () => {
      setErrorMessage('Error reading CSV file. Please try again.')
    }

    reader.readAsText(file)
  }

  const handleStatementDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setStatementDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleStatementFile(e.dataTransfer.files[0])
    }
  }

  const handleStatementChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleStatementFile(e.target.files[0])
    }
  }

  const handleRemoveStatement = () => {
    setStatement(null)
    if (statementInputRef.current) statementInputRef.current.value = ''
  }

  // --- SAMPLE DATA TRIGGER ---
  const handleUseSampleData = async () => {
    setErrorMessage(null)
    await loadSampleData()
    setSuccessMessage('Sample data loaded. You can start the demo.')
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  // --- PROCESS & CONTINUE HANDLER ---
  const handleProcessAndContinue = async () => {
    if (!state.ledger) {
      setErrorMessage('Please upload or capture your handwritten ledger image first.')
      return
    }
    if (!state.statement) {
      setErrorMessage('Please upload your UPI/bank statement CSV file first.')
      return
    }

    const userId = user?.id || 'demo-shopkeeper-001'
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      // Step 1: Uploading ledger image to secure storage
      setProcessingStep('Uploading your ledger to secure storage...')
      await new Promise((r) => setTimeout(r, 400))

      const uploadRes = await ledgerExtractionService.uploadLedgerImage(
        userId,
        state.ledger.fileObj || new Blob(),
        state.ledger.name
      )

      if (uploadRes.error) {
        setErrorMessage(uploadRes.error.message)
        setIsProcessing(false)
        return
      }

      const storagePath = uploadRes.path || `${userId}/${state.ledger.name}`

      // Step 2: Gemini multimodal extraction
      setProcessingStep('Reading your handwritten ledger with AI...')
      await new Promise((r) => setTimeout(r, 600))

      const extractRes = await ledgerExtractionService.extractFromImage(
        userId,
        storagePath,
        state.ledger.fileObj || state.ledger.previewUrl,
        Boolean(state.ledger.isSample)
      )

      if (extractRes.error || !extractRes.data) {
        setErrorMessage(extractRes.error?.message || 'Your ledger could not be read. Please try a clearer photo.')
        setIsProcessing(false)
        return
      }

      // Step 3: Checking extracted entries & calculating confidence
      setProcessingStep('Checking extracted entries & calculating confidence...')
      await new Promise((r) => setTimeout(r, 400))

      setExtractedData(
        extractRes.data.entries,
        extractRes.data.page_quality,
        extractRes.data.warnings
      )

      // Step 4: Import bank/UPI statement CSV if attached
      if (state.statement) {
        setProcessingStep('Importing bank & UPI statement payments...')
        let csvText = state.statement.csvContent
        if (!csvText && state.statement.isSample) {
          try {
            const res = await fetch('/sample-data/sample-statement.csv')
            csvText = await res.text()
          } catch (e) {
            console.error('Failed to fetch sample statement csv', e)
          }
        }
        if (csvText) {
          const parsed = csvParserService.parseCsvString(csvText)
          if (parsed.rows && parsed.rows.length > 0) {
            await paymentImportService.importPayments(userId, parsed.rows, { includeDuplicates: false })
          }
        }
      }

      setProcessingStep('Ledger ready for review.')
      await new Promise((r) => setTimeout(r, 300))

      navigate('/review')
    } catch (err: any) {
      console.error('Process error:', err)
      setErrorMessage(err.message || 'An error occurred during ledger extraction.')
    } finally {
      setIsProcessing(false)
    }
  }

  const canContinue = Boolean(state.ledger && state.statement) && !isProcessing

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Brand Header */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
          KHATA<span className="text-emerald-600">MATCH</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 font-medium max-w-xl mx-auto">
          Turn your paper udhaar book into clear payment matches.
        </p>
      </div>

      {/* Hero Banner with Instant Demo */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-7 shadow-lg shadow-emerald-900/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center space-x-1.5 bg-emerald-500/30 border border-emerald-300/30 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-100">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Judge & Evaluator Quickstart</span>
          </div>
          <p className="text-sm text-emerald-100/90 font-medium">
            Test the complete reconciliation workflow instantly with built-in realistic demo data.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleUseSampleData}
          disabled={isProcessing}
          size="lg"
          className="bg-white text-emerald-900 hover:bg-emerald-50 font-extrabold shadow-md whitespace-nowrap shrink-0 h-12 px-6 rounded-2xl cursor-pointer"
        >
          <Sparkles className="w-4 h-4 mr-2 text-emerald-600" />
          Use Sample Data
        </Button>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="flex items-center space-x-2.5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-2.5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Upload Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* =======================================================
            SECTION 1: LEDGER IMAGE UPLOAD
        ======================================================= */}
        <Card className="rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                  1
                </span>
                <span>Upload your ledger</span>
              </CardTitle>
              {state.ledger && (
                <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  {state.ledger.isSample ? '✓ Ledger sample ready' : 'Ledger ready'}
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500">
              Take a clear photo of your handwritten credit/udhaar page.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              type="file"
              ref={ledgerInputRef}
              onChange={handleLedgerChange}
              accept="image/jpeg,image/jpg,image/png"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleLedgerChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            {!state.ledger ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setLedgerDragOver(true); }}
                onDragLeave={() => setLedgerDragOver(false)}
                onDrop={handleLedgerDrop}
                onClick={() => ledgerInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  ledgerDragOver
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-300'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Tap to upload or drag & drop photo
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports JPG, JPEG, PNG (Max 15MB)
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      cameraInputRef.current?.click()
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Open Camera</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-900/5 border border-slate-200 flex items-center justify-center">
                  <img
                    src={state.ledger.previewUrl}
                    alt="Uploaded handwritten ledger preview"
                    className="w-full h-full object-contain"
                  />
                  {state.ledger.isSample && (
                    <span className="absolute top-2 left-2 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Demo Sample Ledger
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="truncate max-w-[180px] sm:max-w-[220px]">
                    <p className="text-xs font-bold text-slate-800 truncate" title={state.ledger.name}>
                      {state.ledger.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {formatFileSize(state.ledger.size)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => ledgerInputRef.current?.click()}
                      title="Replace Image"
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleRemoveLedger}
                      title="Remove Image"
                      className="p-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* =======================================================
            SECTION 2: STATEMENT CSV UPLOAD
        ======================================================= */}
        <Card className="rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                  2
                </span>
                <span>Upload your UPI / bank statement</span>
              </CardTitle>
              {state.statement && (
                <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  {state.statement.isSample ? '✓ Statement sample ready' : 'Statement ready'}
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500">
              Upload the CSV statement containing your payments.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              type="file"
              ref={statementInputRef}
              onChange={handleStatementChange}
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="hidden"
            />

            {!state.statement ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setStatementDragOver(true); }}
                onDragLeave={() => setStatementDragOver(false)}
                onDrop={handleStatementDrop}
                onClick={() => statementInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  statementDragOver
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-300'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Tap to upload or drag & drop CSV
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Accepts Google Pay, PhonePe, Paytm, or bank .csv
                </p>
                <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    Auto-detects Date, Payer & Amount columns
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate" title={state.statement.name}>
                      {state.statement.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {formatFileSize(state.statement.size)} • CSV Statement
                    </p>
                  </div>
                </div>

                {state.statement.csvContent && (
                  <div className="p-3 bg-slate-100/80 rounded-xl font-mono text-[10px] text-slate-600 max-h-24 overflow-y-auto leading-relaxed">
                    <p className="font-bold text-slate-700 mb-1">CSV Preview Header & First Rows:</p>
                    {state.statement.csvContent.split('\n').slice(0, 4).map((line, i) => (
                      <div key={i} className="truncate">{line}</div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => statementInputRef.current?.click()}
                    title="Replace Statement"
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleRemoveStatement}
                    title="Remove Statement"
                    className="p-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* =======================================================
          SECTION 3: REMINDER LANGUAGE & TONE SELECTORS
      ======================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Language Selector */}
        <Card className="rounded-3xl border border-slate-200/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Languages className="w-4 h-4 text-emerald-600" />
              <span>Reminder language</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Language used when generating customer payment reminder drafts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'english', label: 'English', sub: 'Standard' },
                { id: 'tamil', label: 'Tamil', sub: 'தமிழ்' },
                { id: 'tanglish', label: 'Tanglish', sub: 'Romanized' },
              ].map((item) => {
                const isSelected = state.language === item.id
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={isProcessing}
                    onClick={() => setLanguage(item.id as Language)}
                    className={`py-2.5 px-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-600/20 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                    }`}
                  >
                    <p className="text-xs">{item.label}</p>
                    <p className="text-[10px] text-slate-400 font-normal">{item.sub}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tone Selector */}
        <Card className="rounded-3xl border border-slate-200/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-emerald-600" />
              <span>Reminder tone</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Set the respectfulness and warmth of the reminder message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'polite', label: 'Polite', desc: 'Gentle & respectful' },
                { id: 'friendly', label: 'Friendly', desc: 'Casual & warm' },
                { id: 'firm', label: 'Firm', desc: 'Clear & direct' },
              ].map((item) => {
                const isSelected = state.tone === item.id
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={isProcessing}
                    onClick={() => setTone(item.id as ReminderTone)}
                    className={`py-2 px-2.5 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-600/20 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                    }`}
                  >
                    <p className="text-xs capitalize">{item.label}</p>
                    <p className="text-[9px] text-slate-400 font-normal mt-0.5 truncate" title={item.desc}>
                      {item.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =======================================================
          SECTION 4: CONTINUE ACTION WITH MULTI-STEP PROGRESS
      ======================================================= */}
      <div className="pt-2 flex flex-col items-center space-y-3">
        {isProcessing && (
          <div className="w-full max-w-md p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-in fade-in">
            <div className="flex items-center justify-center space-x-2 text-emerald-800 font-bold text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>{processingStep}</span>
            </div>
            <p className="text-xs text-emerald-700/80">
              Analyzing handwriting with Gemini multimodal AI. This takes a few seconds.
            </p>
          </div>
        )}

        <Button
          type="button"
          onClick={handleProcessAndContinue}
          disabled={!canContinue}
          size="lg"
          className="w-full sm:w-80 h-14 rounded-2xl text-base font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-700/20 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {isProcessing ? (
            <span className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Ledger...</span>
            </span>
          ) : (
            <span className="flex items-center space-x-2">
              <span>Process Ledger & Continue</span>
              <ArrowRight className="w-5 h-5" />
            </span>
          )}
        </Button>

        {!canContinue && !isProcessing && (
          <p className="text-xs text-slate-500 font-medium text-center">
            Upload both a ledger photo and a statement CSV to proceed.
          </p>
        )}
      </div>
    </div>
  )
}
