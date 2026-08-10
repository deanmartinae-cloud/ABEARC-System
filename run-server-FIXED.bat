@echo off
setlocal EnableExtensions
title ABEARC Server Runner

rem Always run from the folder containing this BAT file.
pushd "%~dp0" || (
    echo ERROR: Cannot open the ABEARC application folder.
    pause
    exit /b 1
)

set "PORT=3000"

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or is not available in PATH.
    echo Install Node.js 22 LTS, then run this file again.
    pause
    popd
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or is not available in PATH.
    echo Reinstall Node.js 22 LTS with npm included.
    pause
    popd
    exit /b 1
)

echo ==============================
echo ABEARC local server startup
echo Folder: %CD%
echo ==============================
node --version
call npm --version

echo.
echo ==============================
echo Checking for existing server on port %PORT%...
echo ==============================

set "FOUND_PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set "FOUND_PID=1"
    echo Stopping process using port %PORT%. PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

if not defined FOUND_PID (
    echo No existing LISTENING process found on port %PORT%.
)

echo.
echo ==============================
echo Verifying dependencies...
echo ==============================

node -e "for (const m of ['express','sqlite3','multer','sharp','xlsx']) require(m);" >nul 2>&1
if not errorlevel 1 goto DEPENDENCIES_READY

echo Required packages are missing or incomplete.
echo A clean dependency installation will now be performed.

if exist node_modules (
    echo Removing incomplete node_modules...
    rmdir /s /q node_modules
    if exist node_modules (
        echo ERROR: node_modules could not be completely removed.
        echo Close any Node.js, terminal, editor, or antivirus process using this folder, then try again.
        pause
        popd
        exit /b 1
    )
)

if exist package-lock.json (
    echo Running: npm ci --no-audit --no-fund
    call npm ci --no-audit --no-fund
) else (
    echo package-lock.json not found. Running: npm install --no-audit --no-fund
    call npm install --no-audit --no-fund
)

if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed.
    echo Review the npm error shown above.
    echo This application is tested with Node.js 22 LTS; Node.js 24 may fail on native packages.
    echo Do not start the server until npm completes successfully.
    pause
    popd
    exit /b 1
)

node -e "for (const m of ['express','sqlite3','multer','sharp','xlsx']) require(m); console.log('Core dependencies verified.');"
if errorlevel 1 (
    echo.
    echo ERROR: npm completed, but required packages are still unavailable.
    echo Install Node.js 22 LTS, delete node_modules, and run this file again.
    pause
    popd
    exit /b 1
)

:DEPENDENCIES_READY
echo Dependencies are complete.

echo.
echo ==============================
echo Detecting network address...
echo ==============================

set "NETWORK_IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$config = @(Get-NetIPConfiguration).Where({ $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' })[0]; if ($config.IPv4Address.IPAddress) { $config.IPv4Address.IPAddress }"`) do set "NETWORK_IP=%%i"

if not defined NETWORK_IP (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$address = @(Get-NetIPAddress -AddressFamily IPv4).Where({ $_.IPAddress -ne '127.0.0.1' -and !$_.IPAddress.StartsWith('169.254.') })[0]; if ($address.IPAddress) { $address.IPAddress }"`) do set "NETWORK_IP=%%i"
)

if defined NETWORK_IP (
    set "SERVER_URL=http://%NETWORK_IP%:%PORT%"
) else (
    set "SERVER_URL=http://localhost:%PORT%"
    echo No active LAN IPv4 address was found. Using localhost.
)

echo Network URL: %SERVER_URL%
echo.
echo ==============================
echo Starting server...
echo ==============================

rem Preserve the existing external data-folder location.
set "ABED_DATA_DIR=%~dp0..\ABED Project Mgt data"
start "ABEARC Server" /D "%~dp0" cmd /k "node server.js"

echo Waiting for the server to become ready...
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "if ((Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet -WarningAction SilentlyContinue)) { exit 0 } else { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto OPEN_SERVER
    timeout /t 1 /nobreak >nul
)

echo Server did not become ready within 30 seconds.
echo Review the ABEARC Server window for the exact error.
echo Open this address manually after the server starts: %SERVER_URL%
pause
popd
exit /b 1

:OPEN_SERVER
echo Opening %SERVER_URL% ...
start "" "%SERVER_URL%"
popd
exit /b 0
