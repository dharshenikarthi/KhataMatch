import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface ExtractedEntry {
  customer_name: string
  name_normalized: string
  amount: number
  date: string | null
  type: "credit" | "payment"
  status: "active" | "struck_out"
  confidence: number
  note: string | null
}

interface ExtractionResponse {
  entries: ExtractedEntry[]
  page_quality: "good" | "fair" | "poor"
  warnings: string[]
}

const SYSTEM_PROMPT = `You are a meticulous bookkeeping assistant that digitises handwritten credit ledgers from small Indian shops.
The ledger may be written in:
* English
* Tamil
* Tanglish
* mixed languages

Handwriting may be messy.

TASK:
Read the image and extract every visible credit entry as structured data.

RULES:
1. Extract ONLY what is visible.
2. Never invent names, amounts or dates.
3. Convert amounts such as "1,250", "₹1250", "1250/-" into numeric INR values.
4. Dates must use ISO format YYYY-MM-DD. If year is missing, use the current year. If date is unreadable, return null.
5. Keep customer_name as written in the ledger.
6. Also provide name_normalized (lowercase, trimmed).
7. Handle Tamil names and Tamil transliterations carefully.
8. Give every row a confidence value from 0.0 to 1.0. Lower confidence for smudged writing, overwritten text, crossed-out text, unclear characters, or ambiguous amounts.
9. If a row is crossed out, set status to "struck_out".
10. If a line represents a payment received rather than credit given, set type to "payment".
11. Never invent missing information.
12. Return ONLY valid JSON matching the exact schema. No markdown wrapping (no \`\`\`json), no explanations.`

const JSON_SCHEMA_PROMPT = `Required JSON Output Schema:
{
  "entries": [
    {
      "customer_name": "string",
      "name_normalized": "string",
      "amount": 0,
      "date": "YYYY-MM-DD or null",
      "type": "credit or payment",
      "status": "active or struck_out",
      "confidence": 0.0,
      "note": "string or null"
    }
  ],
  "page_quality": "good | fair | poor",
  "warnings": []
}`

function validateExtractionJson(obj: any): { valid: boolean; data?: ExtractionResponse; error?: string } {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Output is not an object.' }
  }

  if (!Array.isArray(obj.entries)) {
    return { valid: false, error: 'entries must be an array.' }
  }

  const validEntries: ExtractedEntry[] = []

  for (let i = 0; i < obj.entries.length; i++) {
    const item = obj.entries[i]
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Row ${i + 1} is invalid.` }
    }

    const customer_name = String(item.customer_name || '').trim()
    if (!customer_name) {
      return { valid: false, error: `Row ${i + 1} missing customer_name.` }
    }

    const name_normalized = String(item.name_normalized || customer_name.toLowerCase().trim())
    const amount = Number(item.amount)
    if (isNaN(amount) || amount < 0) {
      return { valid: false, error: `Row ${i + 1} amount must be a non-negative number.` }
    }

    let date = item.date
    if (date !== null && typeof date === 'string') {
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try parsing loose date format
        const parsed = new Date(date)
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split('T')[0]
        } else {
          date = null
        }
      }
    } else {
      date = null
    }

    const type = item.type === 'payment' ? 'payment' : 'credit'
    const status = item.status === 'struck_out' ? 'struck_out' : 'active'
    let confidence = Number(item.confidence)
    if (isNaN(confidence)) confidence = 0.8
    confidence = Math.max(0, Math.min(1, confidence))

    validEntries.push({
      customer_name,
      name_normalized,
      amount,
      date,
      type,
      status,
      confidence,
      note: item.note ? String(item.note) : null,
    })
  }

  const page_quality = ['good', 'fair', 'poor'].includes(obj.page_quality) ? obj.page_quality : 'good'
  const warnings = Array.isArray(obj.warnings) ? obj.warnings.map(String) : []

  return {
    valid: true,
    data: {
      entries: validEntries,
      page_quality,
      warnings,
    },
  }
}

async function callGemini(
  apiKey: string,
  modelName: string,
  imageBase64: string,
  mimeType: string,
  attempt: number = 1
): Promise<ExtractionResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${SYSTEM_PROMPT}\n\n${JSON_SCHEMA_PROMPT}` },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json",
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`Gemini API error (attempt ${attempt}):`, errText)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const result = await response.json()
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new Error("No response text received from Gemini.")
  }

  // Clean raw markdown if any
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '')
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '')
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '')
  cleaned = cleaned.trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    if (attempt < 3) {
      console.warn(`JSON parse failed on attempt ${attempt}, retrying...`)
      return callGemini(apiKey, modelName, imageBase64, mimeType, attempt + 1)
    }
    throw new Error("Invalid JSON structure received from model.")
  }

  const validation = validateExtractionJson(parsed)
  if (!validation.valid) {
    if (attempt < 3) {
      console.warn(`Schema validation failed on attempt ${attempt}: ${validation.error}, retrying...`)
      return callGemini(apiKey, modelName, imageBase64, mimeType, attempt + 1)
    }
    throw new Error(`Schema validation error: ${validation.error}`)
  }

  return validation.data!
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Authorization Header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization credentials.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash'

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured on Supabase Edge Function secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify authenticated user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User session is invalid or expired.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { image_path, base64_image, mime_type } = body

    let imageBase64 = ''
    let detectedMimeType = mime_type || 'image/jpeg'

    if (base64_image) {
      // Direct base64 input
      imageBase64 = base64_image.replace(/^data:image\/[a-z]+;base64,/, '')
    } else if (image_path) {
      // Check user permission on storage path
      if (!image_path.startsWith(`${user.id}/`)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized access to the requested image path.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Download from private bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('ledger-images')
        .download(image_path)

      if (downloadError || !fileData) {
        return new Response(
          JSON.stringify({ error: 'Unable to retrieve ledger image from storage.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const buffer = await fileData.arrayBuffer()
      const uint8 = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i])
      }
      imageBase64 = btoa(binary)
      detectedMimeType = fileData.type || 'image/jpeg'
    } else {
      return new Response(
        JSON.stringify({ error: 'Either image_path or base64_image is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Gemini with strict schema & retry
    const extractionResult = await callGemini(geminiApiKey, geminiModel, imageBase64, detectedMimeType)

    return new Response(
      JSON.stringify({
        success: true,
        data: extractionResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Extraction handler exception:', err.message)
    return new Response(
      JSON.stringify({
        error: 'Your ledger could not be read. Please try a clearer photo.',
        details: err.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
