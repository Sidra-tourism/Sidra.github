# Sidra Tourism — owner admin (isolated)

**Frontend** \`admin.sidra-tourism.com\` on a distinct Vercel project \`sidra-admin-portal\`. Authentication: independent Sidra Tourism Supabase project, not TLI. This is an owner-only admin application.

## Required environment variables for admin Vercel project

- \`SIDRA_SUPABASE_URL\` — \`https://rcavyshsxnzodoipsbun.supabase.co\`
- \`SIDRA_SUPABASE_PUBLISHABLE_KEY\` — Sidra Supabase project's publishable key (not service-role)
- \`SIDRA_ADMIN_USER_ID\` — exact owner UUID created and verified in Sidra Supabase Auth.

Never expose a service-role key; none is used by this app. Without all three variables the login fails closed and the workspace cannot be accessed.

## Onboarding

1. Review and apply \`admin/database/sidra_admin_profiles.sql\` to the **Sidra** project.
2. Invite or create the verified owner \`admin@sidra-tourism.com\` in Sidra Supabase Auth only. The initial generated password is temporary; deliver it through a private, approved channel. The owner must choose a strong password (14+ chars) before workspace access.
3. Seed exactly the verified Auth UUID with the documented INSERT (no guessing).
4. Configure a password recovery URL under Sidra Supabase Auth URL configuration, allowing \`https://admin.sidra-tourism.com/**\`; preserve all existing customer URLs.
5. Store the three variables in **sidra-admin-portal**, NOT \`sidra-tourism-site\`. Redeploy isolated admin project.
6. Test owner sign-in, forced password change, forgot/reset password, wrong password, wrong user UUID, logout, cookie flags, and protected API route.
7. Disable unapproved admin public signup. Supabase email confirmations and MFA are recommended for sensitive operations. Do not issue tickets, change payment settings, or elevate any other users.

## Role model

Only the account with *both* email \`admin@sidra-tourism.com\` and the configured UUID is allowed. SQL RLS permits that authenticated user to select only their own admin profile. The role column cannot be edited via the Data API, and public clients cannot insert admin profiles. A verified password change clears the first-login flag.

## Boundaries

This milestone contains read-only operational readiness cards, administrator sign-in, password change, recovery, and profile. Actual booking/CRM financial data and administrative actions are intentionally unavailable until provider connections and audit requirements are verified.
