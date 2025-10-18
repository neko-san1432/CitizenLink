#!/bin/bash

# CodeQL Local Setup Script
# This script helps set up CodeQL CLI for local scanning

set -e

echo "🚀 Setting up CodeQL CLI for local scanning..."

# Determine platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [[ "$PLATFORM" == "darwin" ]]; then
    PLATFORM="osx"
    ARCH="amd64"  # CodeQL doesn't have arm64 for macOS CLI yet
elif [[ "$PLATFORM" == "linux" ]]; then
    PLATFORM="linux"
elif [[ "$PLATFORM" == "mingw"* ]] || [[ "$PLATFORM" == "cygwin"* ]]; then
    PLATFORM="win"
    ARCH="amd64"
fi

# Set CodeQL version (latest as of script creation)
CODEQL_VERSION="2.15.4"

# Create installation directory
CODEQL_HOME="$HOME/codeql"
echo "📁 Installation directory: $CODEQL_HOME"

if [ -d "$CODEQL_HOME" ]; then
    echo "🔄 Removing existing CodeQL installation..."
    rm -rf "$CODEQL_HOME"
fi

mkdir -p "$CODEQL_HOME"

# Download CodeQL CLI
DOWNLOAD_URL="https://github.com/github/codeql-cli-binaries/releases/download/codeql-cli-${CODEQL_VERSION}/codeql-cli-${CODEQL_VERSION}-${PLATFORM}${ARCH}.zip"

echo "📥 Downloading CodeQL CLI from: $DOWNLOAD_URL"

# Check if curl or wget is available
if command -v curl &> /dev/null; then
    curl -L -o codeql.zip "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget -O codeql.zip "$DOWNLOAD_URL"
else
    echo "❌ Neither curl nor wget is available. Please install one of them and try again."
    exit 1
fi

# Extract the archive
echo "📦 Extracting CodeQL CLI..."
unzip -q codeql.zip -d "$CODEQL_HOME"
rm codeql.zip

# Make codeql executable
chmod +x "$CODEQL_HOME/codeql/codeql"

# Verify installation
echo "✅ Verifying CodeQL installation..."
CODEQL_VERSION_OUTPUT=$("$CODEQL_HOME/codeql/codeql" --version)
echo "📋 CodeQL version: $CODEQL_VERSION_OUTPUT"

# Add to PATH (optional)
echo ""
echo "🎯 CodeQL CLI setup completed!"
echo ""
echo "To use CodeQL in your current session, run:"
echo "  export PATH=\"\$HOME/codeql/codeql:\$PATH\""
echo ""
echo "To make it permanent, add this line to your ~/.bashrc or ~/.zshrc:"
echo "  export PATH=\"\$HOME/codeql/codeql:\$PATH\""
echo ""
echo "📖 Usage:"
echo "  node scripts/codeql-local-scan.js          # Run basic scan"
echo "  node scripts/codeql-local-scan.js --help  # Show help"
echo ""
echo "🔗 For more information, visit:"
echo "   https://codeql.github.com/docs/codeql-cli/"
