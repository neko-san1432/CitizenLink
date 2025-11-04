@echo off
setlocal enabledelayedexpansion

echo 🚀 Setting up CodeQL CLI for local scanning...
echo.

REM Create installation directory
set "CODEQL_HOME=%USERPROFILE%\codeql"
echo 📁 Installation directory: %CODEQL_HOME%

REM Remove existing installation if it exists
if exist "%CODEQL_HOME%" (
    echo 🔄 Removing existing CodeQL installation...
    rmdir /s /q "%CODEQL_HOME%"
)

mkdir "%CODEQL_HOME%"

REM Set CodeQL version
set "CODEQL_VERSION=2.15.4"

REM Download CodeQL CLI for Windows
set "DOWNLOAD_URL=https://github.com/github/codeql-cli-binaries/releases/download/codeql-cli-%CODEQL_VERSION%/codeql-cli-%CODEQL_VERSION%-win64.zip"

echo 📥 Downloading CodeQL CLI from: %DOWNLOAD_URL%

REM Check if curl or powershell is available
curl --version >nul 2>&1
if !errorlevel 1! (
    curl -L -o codeql.zip "%DOWNLOAD_URL%"
) else (
    echo ❌ curl is not available. Please download manually from:
    echo    %DOWNLOAD_URL%
    echo    Then extract to: %CODEQL_HOME%
    echo.
    echo 📖 After manual installation, you can run:
    echo    node scripts/codeql-local-scan.js
    goto :end
)

REM Extract the archive
echo 📦 Extracting CodeQL CLI...
powershell -command "Expand-Archive -Path 'codeql.zip' -DestinationPath '%CODEQL_HOME%' -Force"
del codeql.zip

REM Verify installation
echo ✅ Verifying CodeQL installation...
"%CODEQL_HOME%\codeql\codeql.exe" --version
if !errorlevel 1! (
    echo ❌ CodeQL installation failed!
    goto :end
)

echo.
echo 🎯 CodeQL CLI setup completed!
echo.
echo To use CodeQL in your current session, run:
echo   set "PATH=%CODEQL_HOME%\codeql;!PATH!"
echo.
echo To make it permanent, add this to your system PATH:
echo   %CODEQL_HOME%\codeql
echo.
echo 📖 Usage:
echo   node scripts/codeql-local-scan.js          # Run basic scan
echo   node scripts/codeql-local-scan.js --help  # Show help
echo.
echo 🔗 For more information, visit:
echo    https://codeql.github.com/docs/codeql-cli/

:end
