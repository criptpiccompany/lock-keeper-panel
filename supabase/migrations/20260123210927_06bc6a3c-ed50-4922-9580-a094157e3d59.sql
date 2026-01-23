-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('CLOSER', 'ADMIN');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (security best practice: separate table for roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'CLOSER',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create influencers table
CREATE TABLE public.influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_nome TEXT,
  last_closed_at TIMESTAMP WITH TIME ZONE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (handle)
);

-- Create close_events table (immutable audit log)
CREATE TABLE public.close_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  influencer_handle TEXT NOT NULL,
  feito_por_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feito_por_nome TEXT NOT NULL,
  feito_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acao TEXT NOT NULL CHECK (acao IN ('FECHAMENTO', 'OVERRIDE_ADMIN', 'ARQUIVAR')),
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.close_events ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- User roles RLS policies
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Influencers RLS policies
-- Closers can view only active influencers (not archived)
CREATE POLICY "Closers can view active influencers"
  ON public.influencers FOR SELECT
  USING (
    ativo = true OR public.has_role(auth.uid(), 'ADMIN')
  );

-- Admins can view all influencers
CREATE POLICY "Admins can view all influencers"
  ON public.influencers FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Closers can insert new influencers
CREATE POLICY "Authenticated users can insert influencers"
  ON public.influencers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Closers can update influencers they own or that are released
CREATE POLICY "Users can update their own or released influencers"
  ON public.influencers FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      -- User owns the influencer
      owner_id = auth.uid() OR
      -- Influencer is released (no owner or lock expired)
      owner_id IS NULL OR
      last_closed_at IS NULL OR
      (last_closed_at + INTERVAL '10 days') <= now() OR
      -- Admin can update anything
      public.has_role(auth.uid(), 'ADMIN')
    )
  );

-- Close events RLS policies
-- Closers can only view their own events
CREATE POLICY "Closers can view their own events"
  ON public.close_events FOR SELECT
  USING (
    feito_por_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN')
  );

-- Admins can view all events
CREATE POLICY "Admins can view all events"
  ON public.close_events FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Users can insert close events
CREATE POLICY "Authenticated users can insert events"
  ON public.close_events FOR INSERT
  WITH CHECK (auth.uid() = feito_por_id);

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile and assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'CLOSER');
  
  RETURN NEW;
END;
$$;

-- Trigger to handle new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();