# BoatBuild CRM - Local HTTP Server
# Bu script uygulamayi localhost:8080 adresinde calistirir

$port = 8080
$root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BoatBuild CRM - Yerel Sunucu" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sunucu baslatiliyor..." -ForegroundColor Yellow

# HTTP Listener olustur
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host ""
    Write-Host "SUNUCU HAZIR!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tarayicinizda bu adresi acin:" -ForegroundColor White
    Write-Host ""
    Write-Host "   http://localhost:$port" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Durdurmak icin Ctrl+C basin" -ForegroundColor Gray
    Write-Host ""

    # Tarayiciyi otomatik ac
    Start-Process "http://localhost:$port"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath
        if ($localPath -eq "/" -or $localPath -eq "") {
            $localPath = "/BoatBuild-CRM.html"
        }

        $filePath = Join-Path $root $localPath.TrimStart("/")
        
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($request.HttpMethod) $localPath" -ForegroundColor Gray

        if (Test-Path $filePath) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content-Type belirle
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".css" { "text/css; charset=utf-8" }
                ".js" { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png" { "image/png" }
                ".jpg" { "image/jpeg" }
                ".gif" { "image/gif" }
                ".svg" { "image/svg+xml" }
                ".ico" { "image/x-icon" }
                default { "application/octet-stream" }
            }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        }
        else {
            $response.StatusCode = 404
            $errorContent = [System.Text.Encoding]::UTF8.GetBytes("404 - Dosya bulunamadi: $localPath")
            $response.OutputStream.Write($errorContent, 0, $errorContent.Length)
        }

        $response.Close()
    }
}
catch {
    Write-Host "Hata: $_" -ForegroundColor Red
}
finally {
    $listener.Stop()
    Write-Host "Sunucu durduruldu." -ForegroundColor Yellow
}
