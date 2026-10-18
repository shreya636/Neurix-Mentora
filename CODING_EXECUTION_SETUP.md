# Judge0 CE execution setup

Coding Practice sends submissions to Judge0 CE from the existing Netlify function. The backend fetches `/languages/` and resolves the selected language from the names that the configured instance advertises; language IDs are not hard-coded. It creates a submission, polls its token for the terminal result, and returns actual stdout, compiler output, runtime errors, status, time, and memory. Gemini remains exclusively the code review service and receives real Judge0 results only.

## Server environment

Local Netlify development loads the project root `.env` file. Configure:

```dotenv
JUDGE0_URL=https://ce.judge0.com
JUDGE0_AUTH_HEADER=X-Auth-Token
# Leave empty when the Judge0 instance has authentication disabled.
JUDGE0_AUTH_TOKEN=
GEMINI_API_KEY=your-existing-gemini-key
GEMINI_MODEL=gemini-3.8-flash
```

The official Judge0 CE endpoint documents authentication as optional and disabled on its official host. `JUDGE0_AUTH_HEADER` is a header name, not a credential. For a protected Judge0 host, get its token from the host administrator and set server-side `JUDGE0_AUTH_TOKEN`; never use the Gemini key. Do not use a `VITE_` prefix.

For deployed Netlify, add `JUDGE0_URL`, `JUDGE0_AUTH_HEADER`, and (only if required) `JUDGE0_AUTH_TOKEN` under **Site configuration → Environment variables**, then redeploy. A Netlify function cannot call your computer at `127.0.0.1`; `JUDGE0_URL` must be reachable from the function. The public service may enforce rate or capacity limits; the function reports these errors rather than fabricating results.

## Run Mentora locally

From the project root in PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env and preserve your existing server-side app credentials.
npm.cmd run dev:netlify
```

Use `npm.cmd run dev:netlify` so the Netlify function is running. `npm run dev` starts Vite only.

## Verify Judge0 and available languages

From another PowerShell terminal:

```powershell
$base = 'https://ce.judge0.com'
$languages = Invoke-RestMethod "$base/languages/"
$languages | Where-Object { $_.name -match '^(JavaScript|TypeScript|Python|C\s*\(|C\+\+\s*\(|Java\s*\()' } | Select-Object id,name
```

Submit a real JavaScript program without an authentication token:

```powershell
$payload = @{ source_code = 'console.log("judge0-ok")'; language_id = 63; stdin = '' } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri "$base/submissions/?base64_encoded=false&wait=false" -ContentType 'application/json' -Body $payload
Start-Sleep -Seconds 2
Invoke-RestMethod "$base/submissions/$($created.token)?base64_encoded=false" | ConvertTo-Json -Depth 6
```

Use the active JavaScript `id` from `/languages/` if it differs from 63. The final result must show `Accepted` and stdout `judge0-ok`; receiving a token only means the job was queued.

The coding endpoint checks each selected language against the live language list and reports when a runtime is missing. Use each existing language starter and Run Code in Mentora to verify Python, JavaScript, TypeScript, C, C++, and Java. Public service outages/rate limits can prevent execution.

## Official references

- [Judge0 CE API documentation](https://ce.judge0.com/docs): authentication, active languages, submission creation, and polling.
- [Judge0 HTTP API authentication docs](https://docs.judge0.com/products/judge0/http_api/authentication/).
