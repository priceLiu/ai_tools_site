-- Run on Neon (business DB). Replaces Supabase Auth password storage for email/password login.
-- Migrate existing users: copy from Supabase auth.users into this table, e.g.
--   INSERT INTO public.auth_credentials (user_id, email, password_hash)
--   SELECT id, lower(trim(email)), encrypted_password
--   FROM auth.users WHERE encrypted_password IS NOT NULL AND LENGTH(trim(encrypted_password)) > 0
--   ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash;
-- encrypted_password may be bcrypt ($2a$...) or Argon2 ($argon2id$...); app login supports both.
-- Hashes starting with $fbscrypt$ (Firebase) are not verified in-app; those users need to reset password.

CREATE TABLE IF NOT EXISTS public.auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_credentials_email_lower_key ON public.auth_credentials (lower(trim(email)));

-- Optional JSON snapshot cache (replaces Supabase Storage home bundle JSON).
CREATE TABLE IF NOT EXISTS public.app_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
