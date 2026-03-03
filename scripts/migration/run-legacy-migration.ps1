param(
  [Parameter(Mandatory = $true)]
  [string]$LegacySqlPath,

  [string]$PostgresContainer = "global-erp-postgres",
  [string]$PostgresUser = "autoguru",
  [string]$PostgresPassword = "autoguru",
  [string]$PrimaryDatabase = "global_erp",
  [string]$TargetDatabase = "global_erp_migration",
  [string]$MariaDbContainer = "temp-mariadb",
  [string]$MariaDbDatabase = "carguru2",
  [string]$MariaDbRootPassword = "root123",
  [string]$MigrationMode = "append",
  [switch]$KeepTempMariaDb
)

$ErrorActionPreference = "Stop"

function Invoke-DockerCommand {
  param([string]$Command)
  Write-Host ">> $Command"
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $Command"
  }
}

if (-not (Test-Path $LegacySqlPath)) {
  throw "Legacy SQL file not found: $LegacySqlPath"
}

if ($MigrationMode -notin @("append", "replace")) {
  throw "MigrationMode must be append or replace."
}

$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$backupDir = Join-Path $repoRoot "backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetBackup = Join-Path $backupDir ("{0}_{1}.sql" -f $TargetDatabase, $timestamp)

Write-Host ""
Write-Host "1) Backup target DB before migration: $TargetDatabase"
Invoke-DockerCommand "docker exec $PostgresContainer sh -lc ""pg_dump -U $PostgresUser -d $TargetDatabase"" > ""$targetBackup"""

Write-Host ""
Write-Host "2) Recreate target DB from primary DB snapshot"
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d postgres -c ""SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TargetDatabase';"""
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d postgres -c ""DROP DATABASE IF EXISTS $TargetDatabase;"""
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d postgres -c ""CREATE DATABASE $TargetDatabase;"""
Invoke-DockerCommand "docker exec $PostgresContainer sh -lc ""pg_dump -U $PostgresUser -d $PrimaryDatabase | psql -U $PostgresUser -d $TargetDatabase"""

Write-Host ""
Write-Host "3) Start temporary MariaDB and import legacy SQL"
if (docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch $MariaDbContainer) {
  Invoke-DockerCommand "docker rm -f $MariaDbContainer"
}
Invoke-DockerCommand "docker run -d --name $MariaDbContainer -e MARIADB_ROOT_PASSWORD=$MariaDbRootPassword -e MARIADB_DATABASE=$MariaDbDatabase -p 3307:3306 mariadb:10.4"

Start-Sleep -Seconds 15

Invoke-DockerCommand "docker cp ""$LegacySqlPath"" ${MariaDbContainer}:/tmp/legacy.sql"
$importOk = $false
$sourceTableCount = 0
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-DockerCommand "docker exec $MariaDbContainer mariadb -uroot -p$MariaDbRootPassword -e ""DROP DATABASE IF EXISTS $MariaDbDatabase; CREATE DATABASE $MariaDbDatabase;"""
    Invoke-DockerCommand "docker exec $MariaDbContainer sh -lc ""mariadb -uroot -p$MariaDbRootPassword $MariaDbDatabase < /tmp/legacy.sql"""
    $sourceTableCount = docker exec $MariaDbContainer mariadb -N -uroot -p$MariaDbRootPassword -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MariaDbDatabase}'"
    if ($LASTEXITCODE -eq 0 -and [int]$sourceTableCount -gt 0) {
      $importOk = $true
      break
    }
  } catch {
    # Wait and retry until MariaDB auth and import are stable.
  }
  Start-Sleep -Seconds 5
}
if (-not $importOk) {
  throw "Failed to import legacy SQL into MariaDB after retries."
}

Write-Host ""
Write-Host "4) Load legacy schema/data into Postgres target using pgloader"
Invoke-DockerCommand "docker run --rm dimitri/pgloader:latest pgloader ""mysql://root:${MariaDbRootPassword}@host.docker.internal:3307/${MariaDbDatabase}"" ""postgresql://${PostgresUser}:${PostgresPassword}@host.docker.internal:5432/${TargetDatabase}"""
$targetSchemaTableCount = docker exec $PostgresContainer psql -U $PostgresUser -d $TargetDatabase -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='carguru2';"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to verify carguru2 schema in target Postgres."
}
if ([int]$targetSchemaTableCount -le 0) {
  throw "pgloader finished but carguru2 schema has no tables in $TargetDatabase."
}

Write-Host ""
Write-Host "5) Apply table/column mapper from carguru2.* to public.*"
$mapScript = Join-Path $repoRoot "scripts\migration\02_map_carguru2_to_public.sql"
Invoke-DockerCommand "docker cp ""$mapScript"" ${PostgresContainer}:/tmp/02_map_carguru2_to_public.sql"
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d $TargetDatabase -c ""SET app.migration_mode='$MigrationMode';"""
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d $TargetDatabase -f /tmp/02_map_carguru2_to_public.sql"

Write-Host ""
Write-Host "6) Apply custom estimates->job_cards split mapping"
$customMapScript = Join-Path $repoRoot "scripts\migration\03_map_estimates_jobcards.sql"
Invoke-DockerCommand "docker cp ""$customMapScript"" ${PostgresContainer}:/tmp/03_map_estimates_jobcards.sql"
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d $TargetDatabase -f /tmp/03_map_estimates_jobcards.sql"

Write-Host ""
Write-Host "7) Show latest migration summary"
Invoke-DockerCommand "docker exec $PostgresContainer psql -U $PostgresUser -d $TargetDatabase -P pager=off -c ""SELECT status, count(*) AS tables_count, sum(rows_moved) AS rows_total FROM migration.map_run_log WHERE run_at >= now() - interval '30 minutes' GROUP BY status ORDER BY status;"""

if (-not $KeepTempMariaDb) {
  Write-Host ""
  Write-Host "8) Cleanup temporary MariaDB container"
  Invoke-DockerCommand "docker rm -f $MariaDbContainer"
}

Write-Host ""
Write-Host "Completed."
Write-Host "Target backup: $targetBackup"
