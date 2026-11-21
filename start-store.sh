#!/usr/bin/env bash
set -e
echo "========================================"
echo "  Shoptopia Store Server Starting..."
echo "========================================"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Please install Node.js 22+ from https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -d "dist" ]; then
  echo "Building storefront..."
  npm run build
fi

echo ""
echo "Buyer Link:  http://localhost:3000/"
echo "Seller Link: http://localhost:3000/seller"
echo ""
node server.ts --prod
