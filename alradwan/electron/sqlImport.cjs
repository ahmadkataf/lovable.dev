// Reading another shop program's data straight from its SQL Server database on this computer (الأمين and the many
// local programs built on SQL Server). Windows PowerShell and its .NET SQL client come with every Windows, so nothing
// has to be installed: the script signs in as the Windows user (as those programs themselves do), or with the SQL
// login the shop types. It only reads: SELECT on the tables the shop picks, nothing is ever written.
const { execFile } = require('child_process')

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$a = $env:ALRADWAN_SQL | ConvertFrom-Json
$js = $null
try { Add-Type -AssemblyName System.Web.Extensions; $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $js.MaxJsonLength = [int]::MaxValue; $js.RecursionLimit = 64 } catch { $js = $null }
function Out($o) { if ($js) { [Console]::Out.Write($js.Serialize($o)) } else { [Console]::Out.Write((ConvertTo-Json -InputObject $o -Depth 6 -Compress)) } }
function Conn($server, $db) {
  $b = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $b['Data Source'] = $server; $b['Initial Catalog'] = $db; $b['Connect Timeout'] = 8; $b['Application Name'] = 'AlRadwan import (read only)'
  if ($a.user) { $b['User ID'] = $a.user; $b['Password'] = $a.password } else { $b['Integrated Security'] = $true }
  $c = New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString
  $c.Open()
  return $c
}
function Query($c, $sql) {
  $cmd = $c.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 300
  $t = New-Object System.Data.DataTable
  $r = $cmd.ExecuteReader(); $t.Load($r); $r.Close()
  return ,$t
}
function Cell($v) {
  if ($v -is [DBNull] -or $v -is [byte[]]) { return $null }
  if ($v -is [Guid]) { return $v.ToString() }
  if ($v -is [DateTime]) { return $v.ToString('yyyy-MM-ddTHH:mm:ss') }
  if ($v -is [decimal] -or $v -is [single]) { return [double]$v }
  if ($v -is [TimeSpan] -or $v -is [DateTimeOffset]) { return $v.ToString() }
  return $v
}
# a table as [column names, row, row…] (rows as arrays: half the size of objects)
function Grid($t) {
  $out = New-Object System.Collections.ArrayList
  [void]$out.Add([object[]]@($t.Columns | ForEach-Object { $_.ColumnName }))
  foreach ($row in $t.Rows) { [void]$out.Add([object[]]@($row.ItemArray | ForEach-Object { Cell $_ })) }
  return ,$out
}
function Q($name) { return '[' + ([string]$name).Replace(']', ']]') + ']' }
function Has($c, $table) { (Query $c "SELECT CASE WHEN OBJECT_ID(N'dbo.$table', N'U') IS NULL THEN 0 ELSE 1 END AS x").Rows[0].x -eq 1 }
function Servers {
  $names = @()
  foreach ($p in 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server\Instance Names\SQL') {
    if (Test-Path $p) { $names += (Get-Item $p).Property }
  }
  $list = @()
  if ($a.server) { $list += [string]$a.server }
  foreach ($n in ($names | Select-Object -Unique)) { if ($n -eq 'MSSQLSERVER') { $list += '.' } else { $list += ('.\' + $n) } }
  return ,@($list | Select-Object -Unique)
}
function IsLogin($e) { $m = [string]$e.Exception.Message; if ($e.Exception.InnerException) { $m += ' ' + $e.Exception.InnerException.Message }; return ($m -match '18456|Login failed|فشل تسجيل') }
try {
  if ($a.action -eq 'scan') {
    # every database of every SQL Server on this computer; الأمين's are the ones with its materials table mt000
    $found = New-Object System.Collections.ArrayList; $failed = New-Object System.Collections.ArrayList; $servers = Servers
    foreach ($s in $servers) {
      try { $c = Conn $s 'master' } catch { [void]$failed.Add(@{ server = $s; error = [string]$_.Exception.Message; login = (IsLogin $_) }); continue }
      try {
        $dbs = Query $c 'SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name'
        foreach ($d in $dbs.Rows) {
          $name = [string]$d.name; $q = Q $name
          $info = @{ server = $s; database = $name; ameen = $false; tables = 0 }
          try {
            $info.tables = [int](Query $c ("SELECT COUNT(*) AS n FROM " + $q + ".sys.tables")).Rows[0].n
            $has = (Query $c ("SELECT CASE WHEN OBJECT_ID(N'" + ($q + '.dbo.mt000').Replace("'", "''") + "', N'U') IS NULL THEN 0 ELSE 1 END AS x")).Rows[0].x
            if ($has -eq 1) { $info.ameen = $true; $info.products = [int](Query $c ("SELECT COUNT(*) AS n FROM " + $q + ".dbo.mt000")).Rows[0].n }
          } catch { $info.error = [string]$_.Exception.Message }
          [void]$found.Add($info)
        }
      } finally { $c.Close() }
    }
    Out @{ found = $found; failed = $failed; servers = $servers }
  } elseif ($a.action -eq 'tables') {
    # the tables of one database, with their rows and column names
    $c = Conn $a.server $a.database
    try {
      $t = Query $c 'SELECT s.name AS sch, t.name AS tbl, SUM(p.rows) AS n FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1) GROUP BY s.name, t.name'
      $cols = Query $c 'SELECT TABLE_SCHEMA AS sch, TABLE_NAME AS tbl, COLUMN_NAME AS col FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION'
      Out @{ tables = (Grid $t); columns = (Grid $cols) }
    } finally { $c.Close() }
  } elseif ($a.action -eq 'table') {
    # one table's rows (at most 'limit')
    $c = Conn $a.server $a.database
    try {
      $limit = [int]$a.limit; if ($limit -le 0 -or $limit -gt 200000) { $limit = 100000 }
      Out @{ grid = (Grid (Query $c ("SELECT TOP ($limit) * FROM " + (Q $a.schema) + '.' + (Q $a.table)))) }
    } finally { $c.Close() }
  } elseif ($a.action -eq 'ameen') {
    # الأمين: its materials, their groups (the categories) and its price lists
    $c = Conn $a.server $a.database
    try {
      $cols = @((Query $c 'SELECT TOP 0 * FROM dbo.mt000').Columns | ForEach-Object { $_.ColumnName })
      $want = 'GUID','Number','Code','Name','LatinName','BarCode','BarCode2','BarCode3','Unity','Unit2','Unit3','Qty','Whole','Half','Retail','EndUser','Export','Vendor','LastPrice','AvgPrice','MaxPrice','GroupGUID','Company','Origin','Spec','Model','Low','High','Type','bHide'
      $pick = @($cols | Where-Object { $want -contains $_ -or $_ -match 'BarCode' })
      $sel = ($pick | ForEach-Object { Q $_ }) -join ', '
      $res = @{ columns = $cols; materials = (Grid (Query $c "SELECT $sel FROM dbo.mt000")) }
      if (Has $c 'gr000') { $res.groups = Grid (Query $c 'SELECT * FROM dbo.gr000') }
      if (Has $c 'MaterialPriceListItem000') { $res.priceItems = Grid (Query $c 'SELECT MaterialGUID, Unit1Price, ParentGUID FROM dbo.MaterialPriceListItem000') }
      Out $res
    } finally { $c.Close() }
  } else { Out @{ error = 'unknown action' } }
} catch {
  Out @{ error = [string]$_.Exception.Message; login = (IsLogin $_) }
}
`

const ACTIONS = new Set(['scan', 'tables', 'table', 'ameen'])

/** Runs one action: 'scan' (the databases on this computer), 'tables' (one database's tables and columns),
 *  'table' (one table's rows), 'ameen' (الأمين's materials, groups and price lists). */
function sqlPrograms(input) {
  return new Promise(resolve => {
    // ALRADWAN_POWERSHELL: another PowerShell (pwsh), for testing the app away from Windows
    const ps = process.env.ALRADWAN_POWERSHELL || 'powershell.exe'
    if (process.platform !== 'win32' && !process.env.ALRADWAN_POWERSHELL) { resolve({ error: 'windows only' }); return }
    const i = input && typeof input === 'object' ? input : {}
    const str = v => (v === undefined || v === null || v === '' ? undefined : String(v).slice(0, 256))
    const args = { action: str(i.action), server: str(i.server), database: str(i.database), schema: str(i.schema), table: str(i.table), user: str(i.user), password: str(i.password), limit: Number(i.limit) || undefined }
    if (!ACTIONS.has(args.action)) { resolve({ error: 'unknown action' }); return }
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
    execFile(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      env: { ...process.env, ALRADWAN_SQL: JSON.stringify(args) }, windowsHide: true, maxBuffer: 1024 * 1024 * 1024, timeout: 10 * 60000, encoding: 'utf8',
    }, (err, stdout, stderr) => {
      const text = String(stdout || '').replace(/^﻿/, '').trim()
      try { resolve(JSON.parse(text)) } catch { resolve({ error: String(stderr || (err && err.message) || 'no answer').slice(0, 500) }) }
    })
  })
}

module.exports = { sqlPrograms, SCRIPT }
