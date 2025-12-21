#!/bin/bash
# Install pg package and dependencies manually (workaround for npm proxy issues)

echo "Checking for pg package..."

if [ -f "node_modules/pg/package.json" ]; then
    echo "✓ pg package already installed"
    exit 0
fi

echo "Installing pg package manually..."

cd /tmp

# Download all packages
npm pack pg pg-connection-string pg-pool pg-protocol pg-types pgpass \
    pg-int8 pg-numeric postgres-array postgres-bytea postgres-date \
    postgres-interval postgres-range obuf xtend 2>&1 | grep -v "npm notice" | grep -v "npm warn"

# Create node_modules if it doesn't exist
mkdir -p /workspace/node_modules

# Extract and install each package
install_package() {
    local pkg_pattern=$1
    local pkg_name=$2

    tar -xzf ${pkg_pattern}*.tgz -C /workspace/node_modules 2>/dev/null
    if [ -d "/workspace/node_modules/package" ]; then
        mv /workspace/node_modules/package /workspace/node_modules/$pkg_name
        echo "  ✓ Installed $pkg_name"
    fi
}

install_package "pg-8" "pg"
install_package "pg-connection-string" "pg-connection-string"
install_package "pg-pool" "pg-pool"
install_package "pg-protocol" "pg-protocol"
install_package "pg-types" "pg-types"
install_package "pgpass" "pgpass"
install_package "pg-int8" "pg-int8"
install_package "pg-numeric" "pg-numeric"
install_package "postgres-array" "postgres-array"
install_package "postgres-bytea" "postgres-bytea"
install_package "postgres-date" "postgres-date"
install_package "postgres-interval" "postgres-interval"
install_package "postgres-range" "postgres-range"
install_package "obuf" "obuf"
install_package "xtend" "xtend"

# Test if pg loads
cd /workspace
if node -e "require('pg')" 2>/dev/null; then
    echo "✓ pg package installed successfully!"
    exit 0
else
    echo "✗ pg package installation failed"
    exit 1
fi
