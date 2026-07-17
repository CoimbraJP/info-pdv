$pass = "R(U&R!Z&s"
$conn = New-Object -ComObject ADODB.Connection
try {
    $conn.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\DEV\INFO-PDV\BACKUPSH\SHARMAQ\SHOficina\Dados.MDB;Jet OLEDB:Database Password=$pass;")
    $schema = $conn.OpenSchema(20) # adSchemaTables
    if ($schema -eq $null) { throw "Schema is null" }
    
    $tables = @()
    while (-not $schema.EOF) {
        if ($schema.Fields.Item("TABLE_TYPE").Value -eq "TABLE") {
            $tables += $schema.Fields.Item("TABLE_NAME").Value
        }
        $schema.MoveNext()
    }
    
    $schemaData = @{}
    foreach ($table in $tables) {
        $rs = $conn.Execute("SELECT TOP 1 * FROM [$table]")
        $columns = @()
        for ($i=0; $i -lt $rs.Fields.Count; $i++) {
            $columns += $rs.Fields.Item($i).Name
        }
        $schemaData[$table] = $columns
    }
    $conn.Close()
    
    $schemaData | ConvertTo-Json -Depth 3 | Out-File "C:\DEV\INFO-PDV\BACKUPSH\schema.json"
    Write-Host "Success: Schema extracted"
} catch {
    Write-Host "Error: $_"
}
