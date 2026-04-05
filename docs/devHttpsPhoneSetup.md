# Dev HTTPS setup (Phone geolocation / Auto locate)

Mobile browsers typically block `navigator.geolocation` on plain HTTP (`http://192.168.x.x`). To make **Auto locate** work on your phone over Wi‑Fi, run DRIMS over **trusted HTTPS**.

This repo supports HTTPS when these env vars are set:

- `USE_HTTPS=1`
- `SSL_KEY_FILE=...`
- `SSL_CERT_FILE=...`

Default paths (if you don’t set them):

- `certs/dev-key.pem`
- `certs/dev-cert.pem`

## 1) Generate a trusted cert with mkcert (Windows)

1. Install mkcert (choose one):
   - Chocolatey: `choco install mkcert`
   - Winget: `winget install FiloSottile.mkcert`

2. Install the local CA (do this once):

   `mkcert -install`

3. Find your PC’s LAN IP (example `192.168.254.101`).

4. From the repo root, generate a cert for that IP (and localhost):

   `mkdir certs`

   `mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem 192.168.254.101 localhost 127.0.0.1`

If your IP changes, regenerate the cert for the new IP.

## 2) Trust the mkcert CA on your phone

Your phone must trust the mkcert root CA, otherwise the HTTPS page is “not secure” and geolocation will still be blocked.

### Android (Chrome)

- Copy the mkcert root CA certificate to your phone, then install it as a trusted certificate.
- You can find the CA location with:

  `mkcert -CAROOT`

Then copy the root CA file (usually `rootCA.pem`) to the phone and install it.

### iPhone (Safari)

- AirDrop/email the root CA to the phone and install it.
- Then enable full trust:
  Settings → General → About → Certificate Trust Settings → enable trust for the mkcert CA.

## 3) Run DRIMS with HTTPS enabled

In PowerShell (repo root `DRIMS`):

- `Set-Location "C:\Users\John Dave\Desktop\SCHOOL STUFF\citizen_frontend\DRIMS"`
- `$env:NODE_ENV = 'development'`
- `$env:HOST = '0.0.0.0'`
- `$env:PORT = '3000'`
- `$env:USE_HTTPS = '1'`
- `$env:SSL_KEY_FILE = 'certs/dev-key.pem'`
- `$env:SSL_CERT_FILE = 'certs/dev-cert.pem'`
- `npm run dev`

Open on your phone:

- `https://<your-pc-ip>:3000`

Example:

- `https://192.168.254.101:3000`

## Notes

- If you see a cert warning in the browser, the CA likely isn’t trusted yet.
- DRIMS will refuse to start in HTTPS mode if the key/cert files don’t exist (it prints a clear error telling you what’s missing).
