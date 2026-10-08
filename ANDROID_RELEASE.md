# Android release

1. Deploy the PWA over HTTPS and verify the manifest/service worker in Chrome DevTools.
2. Install Bubblewrap and initialize it with the production manifest URL.
3. Choose a stable package ID such as `com.example.knowmeornot`; it cannot be casually changed after release.
4. Add the generated signing certificate fingerprint to `/.well-known/assetlinks.json` on the same origin.
5. Generate the signing key once, store it in an encrypted secrets vault and offline backup, and never commit the keystore or passwords.
6. Run Bubblewrap build to create an Android App Bundle, then test on physical Android devices and Play internal testing.
7. Prepare icon/screenshots, short/full descriptions, support contact, privacy-policy URL and content rating.
8. Complete Play Console Data safety, ads, target audience, app access and permission declarations accurately.
9. Promote from internal to closed/open testing, review crash/ANR reports, then submit to production only with explicit owner approval.

Multiplayer requires connectivity; the offline page clearly explains this rather than simulating a match.
