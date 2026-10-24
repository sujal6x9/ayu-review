ALTER TABLE public.profiles ADD COLUMN username text;
CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (lower(trim(username))) WHERE username IS NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(new.raw_app_meta_data->>'managed_account', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Accounts must be created by an administrator';
  END IF;
  INSERT INTO public.profiles (id, full_name, email, username)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''), new.raw_app_meta_data->>'username');
  RETURN new;
END;
$$;
CREATE OR REPLACE FUNCTION public.protect_profile_username()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Only an administrator can change account usernames';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_profile_username BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_username();