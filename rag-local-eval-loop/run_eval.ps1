param(
    [int]$numAnswerable = 3,
    [int]$numUnanswerable = 3,
    [int]$workers = 1
)

$ErrorActionPreference = "Stop"

$sunoRoot = "d:\antigravity projects\SUNO--RAG-STT"
$evalRoot = Join-Path $sunoRoot "rag-local-eval-loop"
$venvPython = Join-Path $sunoRoot ".venv\Scripts\python.exe"

$env:RAG_PROJECT_ROOT = $sunoRoot
$env:EVAL_EMBEDDER_MODULE = "eval.http_target"
$env:EVAL_GENERATOR_MODULE = "eval.http_target"
# Real HTTP bridge: evaluator calls SUNO's own embedding/generation code over
# HTTP (server/rag/evalBridge.ts, dev-gated). The dev instance runs on 3010.
$env:EVAL_SUNO_BASE_URL = "http://127.0.0.1:3010"
$env:EVAL_HTTP_CONFIG = Join-Path $evalRoot "eval\suno_http_config.json"

# Preserve judge keys if set in the calling environment; otherwise keep unset
if (-not $env:OPENAI_API_KEY) { $env:OPENAI_API_KEY = "" }
if (-not $env:ANTHROPIC_API_KEY) { $env:ANTHROPIC_API_KEY = "" }

Write-Host "Target project: $env:RAG_PROJECT_ROOT"
Write-Host "Using venv:     $venvPython"
Write-Host "Embedder:       $env:EVAL_EMBEDDER_MODULE"
Write-Host "Generator:      $env:EVAL_GENERATOR_MODULE"
Write-Host "HTTP Config:    $env:EVAL_HTTP_CONFIG"
Write-Host ""

Push-Location $evalRoot
try {
    & $venvPython -m eval.runner --rag-root $sunoRoot --num-answerable $numAnswerable --num-unanswerable $numUnanswerable --workers $workers
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
