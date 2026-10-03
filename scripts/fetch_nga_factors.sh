#!/usr/bin/env bash
# Rentswitch - pull the DCCEEW National Greenhouse Accounts Factors 2026 and keep a text
# copy, so every emissions factor in data/ can be checked against the published tables.
set -euo pipefail
mkdir -p data/sources
curl -fsSL -o /tmp/nga.pdf \
  https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf
pdftotext -layout /tmp/nga.pdf data/sources/national-greenhouse-accounts-factors-2026.txt
grep -n -i -E "victoria|new south wales" data/sources/national-greenhouse-accounts-factors-2026.txt | head -40
