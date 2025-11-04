@echo off
echo 🚀 Running migration: Add Missing NGA Departments...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Run the migration script
node run_add_missing_departments.js

echo.
echo ✅ Migration completed!
echo The complaint form should now show all 22 departments.
echo.
pause
