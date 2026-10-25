# Backend setup

## Create the first super-admin

Super-admin accounts cannot be created through public signup. Configure these
variables in the backend environment before running the one-time seed command:

```text
MONGO_URI=your-mongodb-connection-string
SUPERADMIN_NAME=Portal Administrator
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PHONE=1234567890
SUPERADMIN_PASSWORD=use-a-unique-password-at-least-12-characters-long
```

From the `backend` directory, run:

```text
npm run seed:admin
```

The command creates a new super-admin and refuses to modify an account if the
email is already registered. Remove `SUPERADMIN_PASSWORD` from the environment
after setup. Sign in through the regular login screen using the **Super Admin**
role; the protected dashboard is at `/super-admin`.

## Moderation behavior

- Companies and jobs created after moderation is enabled start as pending.
- Existing records with no moderation status remain visible and are treated as
  approved.
- Pending or rejected company/job listings are excluded from public job search.
- Only super-admin accounts can access admin data and moderation endpoints.
- Students and recruiters can report job listings. Recruiters can also report
  applicants; reports are reviewed from the admin dashboard.
