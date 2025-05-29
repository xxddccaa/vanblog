#!/bin/bash

# Remote server details
REMOTE_HOST="107.173.199.53"
REMOTE_PORT="22"
REMOTE_USER="root"  # Assuming username is xiedong based on the path
REMOTE_PASSWORD="8r4UYk7L6PAvvxd97O"
REMOTE_DIR="/root/vanblog"

# Local project directory (current directory)
LOCAL_DIR="."

# Create a password file for sshpass (this is safer than passing password directly on command line)
echo "$REMOTE_PASSWORD" > .rsync_pass
chmod 600 .rsync_pass

# Run rsync with password file and skip host key verification
sshpass -f .rsync_pass rsync -avz -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
    --progress \
    --exclude=".rsync_pass" \
    "$LOCAL_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# Remove the password file
rm .rsync_pass

echo "Sync completed successfully." 