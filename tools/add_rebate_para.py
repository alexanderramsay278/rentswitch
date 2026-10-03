#!/usr/bin/env python3
"""
Add the rebate paragraph to the landlord letter.

WHY IT IS WORDED THE WAY IT IS
The model runs at R = $0 because no primary source gave us a dollar figure.
Two independent checks did confirm that the NSW Energy Savings Scheme discount
and federal Small-scale Technology Certificates STACK, because one is a state
scheme and the other is Commonwealth. So the letter states the mechanism and
refuses to state an amount. That is the same discipline as the rest of the
project: say what is sourced, decline what is not.

The pre-installation rule is the genuinely useful part. Certificates must be
assigned before the system goes in and cannot be claimed retrospectively, which
reinforces the letter's central argument that this should be decided before the
current unit fails rather than after.

Run from the repo clone root:  python tools/add_rebate_para.py
"""

import io
import os
import sys

TS_ANCHOR = """  lines.push(
    `So the question isn't whether to spend ${money(c.cHeatPump)}. It's whether to spend ${money(r.landlord.incremental)} more than you were already going to.`
  );
  lines.push("");"""

TS_NEW = TS_ANCHOR + """

  // Rebates: state the mechanism, never an amount. No primary source gave us a
  // dollar figure, so the model runs at zero and the letter says so plainly.
  if (c.rebate === 0) {
    lines.push(
      `Those numbers assume no rebate at all, which is the cautious way to put it. Two schemes can apply here and they stack, because one is run by New South Wales and the other by the Commonwealth: a discount under the NSW Energy Savings Scheme, and Small scale Technology Certificates. An accredited installer normally claims both and takes them straight off the invoice. I haven't put a figure on either, because the amount depends on the model you pick and who fits it.`
    );
    lines.push("");
    lines.push(
      `Timing does matter though. The certificates have to be assigned before the system goes in, and nobody can claim them back afterwards. That is the practical reason to settle this before the current unit settles it for us.`
    );
    lines.push("");
  }"""

PY_ANCHOR = '''    L += ["", "So the question isn't whether to spend %s. It's whether to spend %s more "
              "than you were already going to." % (money(C), money(r["I"])), ""]'''

PY_NEW = PY_ANCHOR + '''

    # Rebates: state the mechanism, never an amount. See tools/add_rebate_para.py.
    if R == 0:
        L += ["Those numbers assume no rebate at all, which is the cautious way to put it. "
              "Two schemes can apply here and they stack, because one is run by New South "
              "Wales and the other by the Commonwealth: a discount under the NSW Energy "
              "Savings Scheme, and Small scale Technology Certificates. An accredited "
              "installer normally claims both and takes them straight off the invoice. I "
              "haven't put a figure on either, because the amount depends on the model you "
              "pick and who fits it.", ""]
        L += ["Timing does matter though. The certificates have to be assigned before the "
              "system goes in, and nobody can claim them back afterwards. That is the "
              "practical reason to settle this before the current unit settles it for us.", ""]'''


def patch(path, anchor, new, label):
    if not os.path.exists(path):
        print("--  missing", path)
        return False
    s = io.open(path, encoding="utf-8").read()
    if "assume no rebate at all" in s:
        print("--  %s already patched" % label)
        return True
    if anchor not in s:
        print("!!  anchor not found in %s" % label)
        return False
    s = s.replace(anchor, new, 1)
    io.open(path, "w", encoding="utf-8", newline="\n").write(s)
    print("ok  %s patched" % label)
    return True


def main():
    ok = True
    for p in ("src/lib/letter.ts", "src/letter.ts"):
        if os.path.exists(p):
            ok &= patch(p, TS_ANCHOR, TS_NEW, p)
            break
    ok &= patch("tools/letter.py", PY_ANCHOR, PY_NEW, "tools/letter.py")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
