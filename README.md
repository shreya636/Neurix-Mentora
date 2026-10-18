# HR2-OI-9ECCDFE1
HACKERING 2.0 Round 2 Project Repository for Team Neurix (Open Innovation Track)

## Student password sign-in

Apply `supabase/migrations/20261009_student_password_auth.sql` before deploying the password login. It adds a password hash and a required-first-change flag to the existing `public.students` table; it creates no table and changes no student IDs or records. The migration also removes browser access to the credential columns while keeping teachers' existing safe student fields readable.

Existing students need an individually generated temporary password. With server-side `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) configured, run:

```sh
node --env-file=.env.local scripts/set-student-temporary-password.mjs MEN-2026-001
```

The script generates a random temporary password, stores only its scrypt hash, marks the account as requiring a password change, and prints the temporary password once. Share it with that student through a secure channel. On first login the student must set a new password of at least 12 characters. Do not use a Student ID as a password or send the server secret to a browser.

The login function also throttles repeated attempts by Student ID/IP and by IP over a short window. This in-memory throttle is per warm function instance; use a platform-wide rate limit as an additional control if the hosting plan provides one.

Teachers can reset a password from that student's profile only when their account is approved and assigned to the student's class. The reset generates a new random temporary password, invalidates the previous password, and displays the new value once in the current profile view; it is not saved in browser storage or recoverable afterward. Share it securely. The student must replace it at sign-in.
