# Builds both tutorial PDFs with XeLaTeX and copies them to ..\pdf target\
# Usage (from anywhere):  powershell -ExecutionPolicy Bypass -File report\src\build.ps1
# Requires a TeX distribution with latexmk + XeLaTeX (MiKTeX or TeX Live) and the
# Windows fonts Cambria, Calibri, Consolas and Segoe UI Symbol.

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$out = Join-Path (Split-Path $src -Parent) 'pdf target'
New-Item -ItemType Directory -Force $out | Out-Null

$docs = @(
  @{ tex = 'tutorial-vi.tex'; pdf = 'Tutorial-VI.pdf' },
  @{ tex = 'tutorial-en.tex'; pdf = 'Tutorial-EN.pdf' }
)

Push-Location $src
try {
  foreach ($d in $docs) {
    Write-Host "Building $($d.tex) ..."
    latexmk -xelatex -interaction=nonstopmode -halt-on-error -outdir=build $d.tex | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "LaTeX failed for $($d.tex). See build\$([IO.Path]::ChangeExtension($d.tex, 'log'))" }
    Copy-Item (Join-Path 'build' ([IO.Path]::ChangeExtension($d.tex, 'pdf'))) (Join-Path $out $d.pdf) -Force
    Write-Host "  -> pdf target\$($d.pdf)"
  }
} finally {
  Pop-Location
}
