# Trideck 45M REBASE Import Processor
# -----------------------------------
# Rules:
# - Historical raw import - no automatic inference
# - Hak ediş: Do NOT auto-infer
# - All records start as CONDITIONAL
# - Manual review required in CRM

$inputFile = "Trideck_45M_REBASE_IMPORT.xlsx"
$outputFile = "Trideck_45M_REBASE_IMPORT_CRM_READY.csv"

$fullPath = Join-Path $PSScriptRoot $inputFile
$outputPath = Join-Path $PSScriptRoot $outputFile

Write-Host "=== TRIDECK 45M REBASE IMPORT PROCESSOR ===" -ForegroundColor Cyan
Write-Host ""

# Try using COM automation (requires Excel installed)
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    Write-Host "Reading: $inputFile"
    $workbook = $excel.Workbooks.Open($fullPath)
    $sheet = $workbook.Sheets.Item(1)
    
    # Get used range
    $usedRange = $sheet.UsedRange
    $rows = $usedRange.Rows.Count
    $cols = $usedRange.Columns.Count
    
    Write-Host ""
    Write-Host "=== FILE STRUCTURE ===" -ForegroundColor Yellow
    Write-Host "Total rows: $rows (including header)"
    Write-Host "Total columns: $cols"
    
    # Get headers
    $headers = @()
    for ($col = 1; $col -le $cols; $col++) {
        $headers += $sheet.Cells.Item(1, $col).Text
    }
    
    Write-Host ""
    Write-Host "=== COLUMNS ===" -ForegroundColor Yellow
    $headers | ForEach-Object { Write-Host "  - $_" }
    
    # Read data into array
    $data = @()
    for ($row = 2; $row -le $rows; $row++) {
        $rowData = [ordered]@{}
        for ($col = 1; $col -le $cols; $col++) {
            $rowData[$headers[$col-1]] = $sheet.Cells.Item($row, $col).Text
        }
        # Add CRM processing columns
        $rowData["CRM_STATUS"] = "CONDITIONAL"
        $rowData["CRM_REVIEW_REQUIRED"] = "TRUE"
        $rowData["HAK_EDIS_AUTO_INFER"] = "FALSE"
        $data += [PSCustomObject]$rowData
    }
    
    Write-Host ""
    Write-Host "=== SAMPLE DATA (first 5 rows) ===" -ForegroundColor Yellow
    $data | Select-Object -First 5 | Format-Table -AutoSize
    
    Write-Host ""
    Write-Host "=== CRM PROCESSING ===" -ForegroundColor Green
    Write-Host "[+] Added CRM_STATUS = 'CONDITIONAL' for all $($data.Count) records"
    Write-Host "[+] Added CRM_REVIEW_REQUIRED = TRUE for all records"
    Write-Host "[+] Added HAK_EDIS_AUTO_INFER = FALSE (disabled per rules)"
    
    # Export to CSV
    $data | Export-Csv -Path $outputPath -NoTypeInformation -Encoding UTF8
    
    Write-Host ""
    Write-Host "=== OUTPUT ===" -ForegroundColor Green
    Write-Host "Exported to: $outputFile"
    Write-Host "Total records: $($data.Count)"
    Write-Host "Ready for CRM import with manual review workflow"
    
    # Cleanup
    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Excel COM automation failed. Make sure Microsoft Excel is installed." -ForegroundColor Yellow
}
