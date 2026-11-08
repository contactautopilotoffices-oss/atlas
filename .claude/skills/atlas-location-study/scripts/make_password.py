"""Makes the sign-in for a study: an ID, a password, and the two hashes the
site stores instead of them.

    python3 -I make_password.py CHENNAI-AP              # makes a password
    python3 -I make_password.py CHENNAI-AP K7QD-4RMX    # uses yours

Prints:
  * gate hash  -> study.json meta.gate.hash (the study page's own sign-in)
  * passHash   -> clients/manifest.js, only if the site has a root login
                  that routes people to studies (the ATLAS repo does)

Both are SHA-256 of normalised text (trim, upper case, spaces and hyphens
removed), so "k7qd 4rmx" and "K7QD-4RMX" both work. Give the ID and
password to the client privately; never commit them, never put them in
study.json, a PR, or a commit message.

This is a browser-side gate: it keeps a casual visitor out of the view, it
does not make data.js private. Anything truly confidential needs a server
that checks the password before sending data.
"""
import hashlib, secrets, sys

def norm(v):
    return "".join(v.strip().upper().replace("-", "").split())

if len(sys.argv) < 2:
    sys.exit(__doc__)
ident = sys.argv[1]
# 8 characters from a set with no look-alikes (no 0/O, 1/I/L), shown as XXXX-XXXX
ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
pw = sys.argv[2] if len(sys.argv) > 2 else "".join(secrets.choice(ABC) for _ in range(8))
if len(sys.argv) <= 2:
    pw = pw[:4] + "-" + pw[4:]

gate = hashlib.sha256(f"{norm(ident)}:{norm(pw)}".encode()).hexdigest()
root = hashlib.sha256(norm(pw).encode()).hexdigest()
print(f"ID        {ident}")
print(f"password  {pw}    (send privately; do not commit)")
print(f"gate hash {gate}    -> meta.gate.hash")
print(f"passHash  {root}    -> clients/manifest.js (root login only)")
