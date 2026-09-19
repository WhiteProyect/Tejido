$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$FrontendUrl = "http://127.0.0.1:5173/"
$HealthUrl = "http://127.0.0.1:8765/api/health"

function Test-Url($Url) {
    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Start-Module($Directory, $Command) {
    Start-Process powershell.exe -ArgumentList @(
        "-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
        "Set-Location -LiteralPath '$Directory'; $Command"
    ) | Out-Null
}

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkGreen
Write-Host "          INICIANDO TEJIDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor DarkGreen
Write-Host ""

if (-not (Test-Url $HealthUrl)) {
    Start-Module $BackendDir "npm --prefix '$FrontendDir' run dev:backend"

    # El backend ahora se conecta a Neon (red real) al arrancar, no a SQLite
    # local -- tarda mas que el frontend en quedar listo. Sin esta espera, el
    # frontend abre el navegador antes de que el backend responda, y la app
    # muestra errores de "backend no activo" que en realidad son solo un
    # problema de orden de arranque, no un fallo real.
    Write-Host "Esperando a que el backend conecte con la base de datos..." -ForegroundColor DarkYellow
    $backendReady = $false
    foreach ($Attempt in 1..60) {
        if (Test-Url $HealthUrl) {
            $backendReady = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $backendReady) {
        Write-Host "El backend no respondio en 30s -- revisa la ventana del backend por errores (ej. conexion a Neon)." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Backend ya estaba activo." -ForegroundColor Yellow
}

if (-not (Test-Url $FrontendUrl)) {
    Start-Module $FrontendDir "npm run dev -- --host 127.0.0.1 --open"
} else {
    Write-Host "Frontend ya estaba activo." -ForegroundColor Yellow
    Start-Process $FrontendUrl
}

foreach ($Attempt in 1..30) {
    if (Test-Url $FrontendUrl) {
        Write-Host "TEJIDO esta corriendo." -ForegroundColor Green
        Write-Host "Frontend: $FrontendUrl"
        Write-Host "Backend:  http://127.0.0.1:8765"
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "No fue posible confirmar el frontend en el puerto 5173." -ForegroundColor Red
exit 1
