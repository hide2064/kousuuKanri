# 工数管理システム 起動スクリプト
# 使用方法: .\start.ps1 [オプション]
#   オプションなし  : 通常起動
#   -Build          : イメージ再ビルドして起動
#   -Reset          : DBデータ削除 + 再ビルドして起動
#   -Stop           : システム停止
#   -Logs           : ログ表示（Ctrl+C で終了）
#   -Status         : コンテナ状態表示

param(
    [switch]$Build,
    [switch]$Reset,
    [switch]$Stop,
    [switch]$Logs,
    [switch]$Status
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# スクリプトのあるディレクトリに移動
Push-Location $PSScriptRoot

function Write-Header {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  工数管理システム" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Wait-ForHealth {
    param([string]$Url, [int]$MaxRetries = 30, [int]$IntervalSec = 3)
    Write-Host "サービス起動待機中..." -ForegroundColor Yellow
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($res.StatusCode -lt 500) {
                return $true
            }
        } catch { }
        Write-Host "  待機中... ($i/$MaxRetries)" -ForegroundColor Gray
        Start-Sleep -Seconds $IntervalSec
    }
    return $false
}

# --- 停止 ---
if ($Stop) {
    Write-Header
    Write-Host "システムを停止します..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "停止しました。" -ForegroundColor Green
    Pop-Location
    exit 0
}

# --- ログ表示 ---
if ($Logs) {
    Write-Header
    Write-Host "ログを表示します（Ctrl+C で終了）" -ForegroundColor Yellow
    docker-compose logs -f
    Pop-Location
    exit 0
}

# --- 状態表示 ---
if ($Status) {
    Write-Header
    Write-Host "コンテナ状態:" -ForegroundColor Yellow
    docker-compose ps
    Write-Host ""
    Pop-Location
    exit 0
}

# --- .env チェック ---
Write-Header

if (-not (Test-Path ".env")) {
    Write-Host ".env ファイルが見つかりません。.env.example からコピーします..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "  → .env を作成しました。必要に応じてパスワードを変更してください。" -ForegroundColor Gray
    Write-Host ""
}

# --- Docker 動作確認 ---
try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "[ERROR] Docker が起動していません。Docker Desktop を起動してから再実行してください。" -ForegroundColor Red
    Pop-Location
    exit 1
}

# --- データリセット ---
if ($Reset) {
    Write-Host "DBデータを削除します..." -ForegroundColor Yellow
    $confirm = Read-Host "本当に削除しますか？ (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "キャンセルしました。" -ForegroundColor Gray
        Pop-Location
        exit 0
    }
    docker-compose down -v
    Write-Host "  → DBデータを削除しました。" -ForegroundColor Gray
    Write-Host ""
    $Build = $true
}

# --- 起動 ---
if ($Build) {
    Write-Host "イメージをビルドして起動します..." -ForegroundColor Yellow
    docker-compose up --build -d
} else {
    Write-Host "システムを起動します..." -ForegroundColor Yellow
    docker-compose up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 起動に失敗しました。docker-compose のログを確認してください。" -ForegroundColor Red
    Write-Host "  .\start.ps1 -Logs" -ForegroundColor Gray
    Pop-Location
    exit 1
}

# --- ヘルスチェック ---
Write-Host ""
$ok = Wait-ForHealth -Url "http://localhost" -MaxRetries 40 -IntervalSec 3

Write-Host ""
if ($ok) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  起動完了！" -ForegroundColor Green
    Write-Host "  URL: http://localhost" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "その他のコマンド:" -ForegroundColor Gray
    Write-Host "  .\start.ps1 -Stop    # 停止" -ForegroundColor Gray
    Write-Host "  .\start.ps1 -Logs    # ログ表示" -ForegroundColor Gray
    Write-Host "  .\start.ps1 -Status  # 状態確認" -ForegroundColor Gray
    Write-Host "  .\start.ps1 -Build   # 再ビルドして起動" -ForegroundColor Gray
    Write-Host "  .\start.ps1 -Reset   # DBリセット + 再ビルド" -ForegroundColor Gray
    Write-Host ""

    # ブラウザを開く
    try {
        Start-Process "http://localhost"
    } catch { }
} else {
    Write-Host "[WARNING] サービスの応答確認がタイムアウトしました。" -ForegroundColor Yellow
    Write-Host "  ログを確認してください: .\start.ps1 -Logs" -ForegroundColor Gray
}

Pop-Location
