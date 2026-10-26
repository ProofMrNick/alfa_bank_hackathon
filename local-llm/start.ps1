$ErrorActionPreference = 'Stop'

$serverPath = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe\llama-server.exe'
$modelPath = Join-Path $PSScriptRoot 'models\Llama-3.2-1B-Instruct-Q4_K_M.gguf'

if (-not (Test-Path -LiteralPath $serverPath)) {
    throw 'llama.cpp is not installed. Run: winget install --id ggml.llamacpp'
}
if (-not (Test-Path -LiteralPath $modelPath)) {
    throw "Model file is missing: $modelPath"
}

& $serverPath `
    --model $modelPath `
    --host 127.0.0.1 `
    --port 8081 `
    --ctx-size 2048 `
    --threads 4 `
    --n-gpu-layers 0
