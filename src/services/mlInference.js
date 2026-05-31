/**
 * mlInference.js
 * Node.js wrapper for Python ML inference scripts.
 * Models run on Apple Silicon MPS via PyTorch.
 *
 * Strategy:
 * - Deal-breaker detection: ALWAYS runs (primary)
 * - Sub-score prediction: ALWAYS runs (primary)
 * - Trip-type classification: NOT used — sourced from Tripadvisor trip_types field only
 *
 * In browser context (Vite frontend), child_process is unavailable.
 * All functions degrade gracefully: callers receive safe fallback values.
 */

async function runPythonScript(scriptName, inputData) {
  let spawn, scriptPath, mlDir
  try {
    const cp = await import(/* @vite-ignore */ 'child_process')
    const path = await import(/* @vite-ignore */ 'path')
    const url = await import(/* @vite-ignore */ 'url')
    spawn = cp.spawn
    const __filename = url.fileURLToPath(import.meta.url)
    mlDir = path.resolve(path.dirname(__filename), '../../server/ml')
    scriptPath = path.join(mlDir, scriptName)
  } catch {
    throw new Error('ML inference requires Node.js environment')
  }

  return new Promise((resolve, reject) => {
    const python = spawn('/opt/anaconda3/envs/travia/bin/python3', [scriptPath], { cwd: mlDir })

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => { stdout += data.toString() })
    python.stderr.on('data', (data) => { stderr += data.toString() })

    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`[ML] ${scriptName} exited with code ${code}: ${stderr}`)
        reject(new Error(`ML script failed: ${stderr}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch (e) {
        reject(new Error(`ML script returned invalid JSON: ${stdout}`))
      }
    })

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}`))
    })

    python.stdin.write(JSON.stringify(inputData))
    python.stdin.end()
  })
}

/**
 * Detect deal-breakers in review texts.
 * Primary model — 92% accuracy.
 */
export async function detectDealbreakers(reviewTexts) {
  if (!reviewTexts?.length) return []
  try {
    return await runPythonScript('infer_dealbreaker.py', reviewTexts)
  } catch (err) {
    console.warn('[ML] Dealbreaker detection failed:', err.message)
    return reviewTexts.map(() => ({
      label: 'SAFE', confidence: 0, is_dealbreaker: false, is_warning: false
    }))
  }
}

/**
 * Predict sub-scores from a single review text.
 * Primary model — MAE ~0.46 on 1-5 scale.
 */
export async function predictSubscores(reviewText) {
  if (!reviewText) return null
  try {
    return await runPythonScript('infer_subscore.py', reviewText)
  } catch (err) {
    console.warn('[ML] Sub-score prediction failed:', err.message)
    return null
  }
}

/**
 * Pick dominant trip type from Tripadvisor trip_types field (by count).
 * Format: [{ name: "couples", value: "371" }, ...]
 */
function getDominantTripTypeFromTripadvisor(tripTypes) {
  if (!tripTypes || !Array.isArray(tripTypes)) return null
  const sorted = [...tripTypes].sort((a, b) => parseInt(b.value) - parseInt(a.value))
  return sorted[0]?.name?.toUpperCase() || null
}

/**
 * Full review analysis — primary entry point.
 *
 * @param {string[]} reviewTexts - Array of review text strings
 * @param {Array|null} tripadvisorTripTypes - Tripadvisor trip_types field, e.g.
 *   [{ name: "couples", value: "371" }, { name: "family", value: "237" }]
 *   Pass null if not available; dominant_trip_type will be null.
 */
export async function analyzeReviews(reviewTexts, tripadvisorTripTypes = null) {
  if (!reviewTexts?.length) {
    return {
      dealbreakers: [],
      subscores: null,
      dominant_trip_type: null,
      has_dealbreakers: false,
      has_warnings: false,
    }
  }

  // Run both primary models in parallel — one failure doesn't block the other
  const [dealbreakerResult, subscoreResult] = await Promise.allSettled([
    detectDealbreakers(reviewTexts),
    Promise.all(reviewTexts.map((t) => predictSubscores(t))),
  ])

  const dealbreakers = dealbreakerResult.status === 'fulfilled' ? dealbreakerResult.value : []
  const has_dealbreakers = dealbreakers.some((r) => r.is_dealbreaker)
  const has_warnings = dealbreakers.some((r) => r.is_warning)

  let subscores = null
  if (subscoreResult.status === 'fulfilled') {
    const validResults = subscoreResult.value.filter(Boolean)
    if (validResults.length > 0) {
      const keys = Object.keys(validResults[0])
      subscores = {}
      for (const key of keys) {
        const avg = validResults.reduce((sum, s) => sum + (s[key] || 0), 0) / validResults.length
        subscores[key] = parseFloat(avg.toFixed(2))
      }
    }
  }

  // Trip type — Tripadvisor only, no ML fallback
  const dominant_trip_type = getDominantTripTypeFromTripadvisor(tripadvisorTripTypes)

  return {
    dealbreakers,
    has_dealbreakers,
    has_warnings,
    subscores,
    dominant_trip_type,
  }
}
