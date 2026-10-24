DROP TRIGGER IF EXISTS protect_profile_username ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_username();
DROP INDEX IF EXISTS public.profiles_username_unique;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS username;

CREATE UNIQUE INDEX profiles_email_unique ON public.profiles (lower(trim(email)));

CREATE OR REPLACE FUNCTION public.protect_profile_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Email addresses must be changed through account administration';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_email
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_email();
