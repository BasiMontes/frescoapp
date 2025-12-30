-- 1. Habilitar extensiones
create extension if not exists "uuid-ossp";

-- 2. Tabla de PERFILES (Usuarios)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  email text,
  dietary_preferences text[],
  favorite_cuisines text[],
  cooking_experience text default 'intermediate',
  household_size integer default 1,
  onboarding_completed boolean default false,
  total_savings numeric default 0,
  meals_cooked integer default 0,
  created_at timestamptz default timezone('utc'::text, now())
);

-- Seguridad (RLS) para Perfiles
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 3. Tabla de DESPENSA (Pantry Items)
create table public.pantry_items (
  id text not null primary key, -- IDs generados en cliente (ej: 'manual-123')
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  quantity numeric not null,
  unit text not null,
  category text,
  added_at timestamptz default timezone('utc'::text, now()),
  expires_at timestamptz
);

-- Seguridad (RLS) para Despensa
alter table public.pantry_items enable row level security;

create policy "Users can view own pantry" on public.pantry_items
  for select using (auth.uid() = user_id);

create policy "Users can insert own pantry" on public.pantry_items
  for insert with check (auth.uid() = user_id);

create policy "Users can update own pantry" on public.pantry_items
  for update using (auth.uid() = user_id);

create policy "Users can delete own pantry" on public.pantry_items
  for delete using (auth.uid() = user_id);

-- 4. Tabla de RECETAS
-- Guardamos el objeto completo en JSONB para flexibilidad
create table public.recipes (
  id text not null primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  data jsonb not null, 
  created_at timestamptz default timezone('utc'::text, now())
);

-- Seguridad (RLS) para Recetas
alter table public.recipes enable row level security;

create policy "Users can view own recipes" on public.recipes
  for select using (auth.uid() = user_id);

create policy "Users can insert own recipes" on public.recipes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own recipes" on public.recipes
  for update using (auth.uid() = user_id);

create policy "Users can delete own recipes" on public.recipes
  for delete using (auth.uid() = user_id);

-- 5. Tabla de PLAN DE COMIDAS (Meal Plan)
create table public.meal_plan (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date text not null, -- Formato YYYY-MM-DD
  type text not null, -- 'breakfast', 'lunch', 'dinner'
  recipe_id text,
  servings integer default 1,
  is_cooked boolean default false,
  created_at timestamptz default timezone('utc'::text, now()),
  unique(user_id, date, type)
);

-- Seguridad (RLS) para Plan
alter table public.meal_plan enable row level security;

create policy "Users can view own meal plan" on public.meal_plan
  for select using (auth.uid() = user_id);

create policy "Users can insert own meal plan" on public.meal_plan
  for insert with check (auth.uid() = user_id);

create policy "Users can update own meal plan" on public.meal_plan
  for update using (auth.uid() = user_id);

create policy "Users can delete own meal plan" on public.meal_plan
  for delete using (auth.uid() = user_id);

-- 6. Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();