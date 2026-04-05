param([Parameter(Mandatory=$true)][string]$DbUrl)
$ErrorActionPreference = 'Stop'

# Requires psql in PATH
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part001.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part002.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part003.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part004.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part005.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part006.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part007.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile
$sqlFile = "C:\\Users\\Neko-san\\Documents\\projects\\CitizenLink\\src\\db\\seeds\\seedBulkComplaints.20k.part008.sql"; Write-Host "Running $sqlFile"; psql "$DbUrl" -v ON_ERROR_STOP=1 -f $sqlFile