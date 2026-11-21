@echo off
echo ========================================
echo   Su^&KoKo Store Server Starting...
echo ========================================
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Please install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

if not exist dist (
  echo Building storefront...
  call npm run build
)

echo.
echo Buyer Link:  http://localhost:3000/
echo Seller Link: http://localhost:3000/seller
echo.
node server.ts --prod
pause
