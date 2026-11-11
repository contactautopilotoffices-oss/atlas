/* Who may take the presenter remote. Each entry is the SHA-256 of "ID:PASSWORD" (capitals, no spaces or
   hyphens), the same form the Skymark gate uses, so no password is stored here.
   - the Skymark atlas sign-in (the same pair as /noida-skymark/)
   - a presenter pair for demos, chosen by the owner on 11 Nov 2026 */
window.VOLT_REMOTE = { presenters: [
  "d9f586a32c88a68d2496a990cff6773768d43fd080548c4193d56091c737af56",
  "a5b085533ba6c551de077979e7d43bde3f7c03e7cb3682481ed87166df7bb90f"
] };
