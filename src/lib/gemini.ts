import { LedgerEntry } from '@/types'

const STORAGE_KEY = 'khatamatch_gemini_api_key'

export function getGeminiApiKey(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved.trim()) return saved.trim()
  } catch (e) {
    console.warn('Unable to access localStorage for Gemini API key', e)
  }
  return import.meta.env.VITE_GEMINI_API_KEY || null
}

export function setGeminiApiKey(key: string): void {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, key.trim())
    }
  } catch (e) {
    console.warn('Unable to set Gemini API key in localStorage', e)
  }
}

export async function fileToGenerativePart(
  input: File | Blob | string
): Promise<{ inlineData: { data: string; mimeType: string } }> {
  // Case 1: Base64 Data URL (e.g., data:image/jpeg;base64,...)
  if (typeof input === 'string' && input.startsWith('data:')) {
    const parts = input.split(',')
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const base64Data = parts[1] || ''
    return {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    }
  }

  // Case 2: URL string (blob: or http/https or relative path)
  if (typeof input === 'string') {
    try {
      const res = await fetch(input)
      const blob = await res.blob()
      return fileToGenerativePart(blob)
    } catch (e) {
      console.warn('Failed to fetch image URL, attempting raw reader', e)
    }
  }

  // Case 3: Blob / File object
  if (input instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const base64Data = result ? result.split(',')[1] : ''
        const mimeType = input.type || 'image/jpeg'
        resolve({
          inlineData: {
            data: base64Data,
            mimeType,
          },
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(input)
    })
  }

  throw new Error('Invalid image format provided. Please re-select your ledger image.')
}


const EXTRACTION_SYSTEM_PROMPT = `You are an expert OCR and bookkeeping assistant that digitizes handwritten credit/udhaar ledgers from small Indian shops.
The ledger contains handwritten rows of customers, dates, and amounts (in INR).
Languages may include English, Tamil (தமிழ்), Tanglish, or Romanized transliterations.

TASK:
Read the uploaded ledger image and extract every single visible credit entry as structured data.

RULES:
1. Extract ONLY what is visible in the image.
2. Convert amounts (e.g. "1,250", "₹1250", "1250/-", "1500") into numeric numbers.
3. Keep customer_name exactly as written.
4. Set name_normalized to lowercase trimmed English/Romanized representation without special symbols.
5. Format dates as YYYY-MM-DD (e.g., 2026-10-04). If year is omitted, use current year (2026). If date is unreadable, set null.
6. If an entry is crossed out or struck out with a pen line, set status to "struck_out", otherwise "active".
7. Assign confidence score between 0.0 and 1.0 (e.g. 0.95 for clear text, 0.65 for smudged or struck-out text).
8. Return ONLY valid JSON matching this schema:
{
  "entries": [
    {
      "customer_name": "Ravi Kumar",
      "name_normalized": "ravi kumar",
      "amount": 1500,
      "date": "2026-10-04",
      "type": "credit",
      "status": "active",
      "confidence": 0.95,
      "note": "Optional remark"
    }
  ],
  "page_quality": "good",
  "warnings": []
}`

export async function callGeminiVisionExtract(
  fileOrBlob: File | Blob | string
): Promise<{ entries: Partial<LedgerEntry>[]; page_quality: 'good' | 'fair' | 'poor'; warnings: string[] }> {
  const apiKey = getGeminiApiKey()
  if (!apiKey || !apiKey.trim()) {
    throw new Error('No Gemini API key found. Please provide an API key in Shop Settings or in .env.')
  }

  const cleanKey = apiKey.trim()
  const imagePart = await fileToGenerativePart(fileOrBlob)

  const models = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
  ]

  let lastError: Error | null = null

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: EXTRACTION_SYSTEM_PROMPT },
                imagePart,
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        let parsedErrMsg = errText
        try {
          const errObj = JSON.parse(errText)
          parsedErrMsg = errObj?.error?.message || errText
        } catch {
          // ignore
        }
        throw new Error(`Gemini API error (${response.status}): ${parsedErrMsg}`)
      }

      const json = await response.json()
      const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!candidateText) {
        throw new Error('Gemini API returned an empty response.')
      }

      const parsed = JSON.parse(candidateText)
      return {
        entries: parsed.entries || [],
        page_quality: parsed.page_quality || 'good',
        warnings: parsed.warnings || [],
      }
    } catch (err: any) {
      lastError = err
      // If error is authentication/permission related, don't keep hammering
      if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid'))) {
        throw err
      }
    }
  }

  throw lastError || new Error('Failed to extract ledger entries using Gemini.')
}


