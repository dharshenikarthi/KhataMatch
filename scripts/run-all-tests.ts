import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const testFiles = [
  'src/services/__tests__/deterministicMatch.test.ts',
  'src/services/__tests__/aiMatch.test.ts',
  'src/services/__tests__/balanceTracking.test.ts',
  'src/services/__tests__/reminderGeneration.test.ts',
  'src/services/__tests__/reminderHistory.test.ts',
  'src/services/__tests__/analytics.test.ts',
  'eval/scripts/eval.test.ts',
]

console.log('========================================================')
console.log('       RUNNING ALL KHATAMATCH TEST SUITES (1-13)        ')
console.log('========================================================\n')

let totalFailed = 0

for (const testFile of testFiles) {
  const fullPath = path.resolve(__dirname, '..', testFile)
  console.log(`\n▶ Running: ${testFile}`)
  const result = spawnSync('npx', ['tsx', fullPath], {
    stdio: 'inherit',
    shell: true,
  })

  if (result.status !== 0) {
    totalFailed++
    console.error(`❌ FAILED: ${testFile}`)
  }
}

console.log('\n========================================================')
if (totalFailed === 0) {
  console.log('🎉 ALL 7 TEST SUITES PASSED CLEANLY WITH ZERO FAILURES!')
} else {
  console.error(`💥 ${totalFailed} TEST SUITE(S) FAILED`)
  process.exit(1)
}
console.log('========================================================\n')
