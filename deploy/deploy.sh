#!/bin/bash
# Lives on the Droplet at /opt/education-i2/deploy.sh -- this copy in the repo
# is for documentation/version-control only, it isn't auto-synced. If you
# change it, update /opt/education-i2/deploy.sh on the server too.
#
# Invoked as a forced command (see authorized_keys on the server) by the
# GitHub Actions deploy key -- that key has no shell access, it can only
# ever run this exact script, regardless of what command it's asked to run.
set -e
cd /opt/education-i2
tar -xzf -
docker compose up -d --build
