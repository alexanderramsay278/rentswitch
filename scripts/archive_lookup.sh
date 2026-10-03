#!/usr/bin/env bash
# Rentswitch - list Internet Archive captures of the government documents we cite, so a
# blocked official URL can be read from its byte-for-byte archived copy.
set -u
for pat in \
  "dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026*" \
  "dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2026*" \
  "energyrating.gov.au/sites/default/files/2026-04/*" \
  "energyrating.gov.au/industry-information/publications/decision-ris-energy-efficiency-heat-pump-water-heaters*" \
  "energyrating.gov.au/sites/default/files/2026-0*" ; do
  echo "== $pat"
  curl -s --max-time 60 "https://web.archive.org/cdx/search/cdx?url=${pat}&output=txt&fl=timestamp,original,statuscode,mimetype,length&collapse=urlkey&limit=40" || echo "(lookup failed)"
done
