-- ==============================================================================
-- NOGAL CASINO ROYALE - SUPABASE DATABASE SCHEMA
-- Copia y pega este script completo en el SQL Editor de tu proyecto Supabase
-- ==============================================================================

-- 1. Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 2. Tabla de Usuarios / Perfiles
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'Jugador',
  email text,
  estado text not null default 'activo',
  zona_horaria text not null default 'America/Bogota',
  limite_perdida_sesion bigint default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Billeteras (Wallets)
create table if not exists public.wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  saldo_actual bigint not null default 10000 check (saldo_actual >= 0),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabla del Catálogo de Juegos
create table if not exists public.games (
  id serial primary key,
  slug text not null unique,
  nombre_juego text not null,
  tipo text not null,
  categoria text not null,
  descripcion text,
  estado_activo boolean not null default true,
  apuesta_minima integer not null default 10,
  apuesta_maxima integer not null default 5000,
  ventaja_casa numeric(5, 4) not null default 0.0300,
  config jsonb default '{}'::jsonb
);

-- 5. Tabla de Apuestas e Historial (Bets)
create table if not exists public.bets (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  game_slug text not null,
  game_title text not null,
  monto_apostado integer not null,
  monto_premio integer not null default 0,
  multiplicador numeric(8, 2) not null default 0.00,
  estado text not null default 'completado',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Tabla de Reclamos de Bono Diario (Daily Claims)
create table if not exists public.daily_claims (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  fecha_reclamo date not null,
  racha integer not null default 1,
  monto integer not null default 500,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, fecha_reclamo)
);

-- 7. Poblar Catálogo con los 10 Juegos
insert into public.games (slug, nombre_juego, tipo, categoria, descripcion, apuesta_minima, apuesta_maxima, ventaja_casa)
values
  ('crash', 'Crash Rocket', 'arcade', 'arcade', 'Multiplicador exponencial en tiempo real', 10, 5000, 0.0300),
  ('mines', 'Minas del Faraón', 'arcade', 'arcade', 'Buscaminas 5x5 con gemas y bombas', 10, 5000, 0.0200),
  ('roulette', 'Ruleta Royale 3D', 'mesa', 'table', 'Ruleta europea clásica con tapete interactivo', 10, 10000, 0.0270),
  ('blackjack', 'Blackjack 21 Pro', 'cartas', 'cards', 'Vence al croupier con Blackjack 3:2', 20, 10000, 0.0050),
  ('slots', 'Neon Fruits 777', 'slots', 'slots', 'Tragamonedas clásica 5 rodillos y 5 líneas', 10, 2500, 0.0350),
  ('plinko', 'Plinko Pachinko', 'arcade', 'arcade', 'Pirámide de clavijas con rebotes físicos', 10, 5000, 0.0250),
  ('videopoker', 'Video Poker Jacks+', 'cartas', 'cards', 'Póker de 5 cartas con función Hold', 10, 5000, 0.0120),
  ('dice', 'Dados Hi-Lo Royale', 'mesa', 'table', 'Predicción de par de dados 3D y combinaciones', 10, 5000, 0.0280),
  ('baccarat', 'Baccarat Punto y Banca', 'cartas', 'cards', 'Juego VIP Punto vs Banca vs Empate', 25, 10000, 0.0110),
  ('wheel', 'Mega Wheel Fortuna', 'arcade', 'arcade', 'Gran rueda de 54 casillas con JACKPOT 100x', 10, 5000, 0.0320)
on conflict (slug) do update set
  nombre_juego = excluded.nombre_juego,
  categoria = excluded.categoria,
  descripcion = excluded.descripcion;

-- 8. Procedimiento Almacenado RPC: wallet_apply (Manejo atómico de saldo con bloqueo FOR UPDATE)
create or replace function public.wallet_apply(
  p_user_id uuid,
  p_tipo text,
  p_monto integer,
  p_bet_id bigint default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_saldo_actual bigint;
  v_nuevo_saldo bigint;
begin
  -- Bloquear fila de la billetera para evitar condiciones de carrera
  select saldo_actual into v_saldo_actual
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Billetera no encontrada para el usuario %', p_user_id;
  end if;

  -- Para apuestas, verificar fondos suficientes
  if p_tipo = 'apuesta' then
    if v_saldo_actual < abs(p_monto) then
      raise exception 'Saldo insuficiente para realizar la apuesta';
    end if;
    v_nuevo_saldo := v_saldo_actual - abs(p_monto);
  else
    -- Premios, recargas o bonos suman al saldo
    v_nuevo_saldo := v_saldo_actual + abs(p_monto);
  end if;

  -- Actualizar saldo
  update public.wallets
  set saldo_actual = v_nuevo_saldo,
      updated_at = timezone('utc'::text, now())
  where user_id = p_user_id;

  return v_nuevo_saldo;
end;
$$;

-- 9. Trigger para Crear Automáticamente Perfil y Billetera con $10,000 fichas al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Crear perfil en public.users
  insert into public.users (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Jugador'),
    new.email
  );

  -- Crear billetera con bono de bienvenida de $10,000 fichas
  insert into public.wallets (user_id, saldo_actual)
  values (new.id, 10000);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 10. Políticas de Seguridad RLS (Row Level Security)
alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.games enable row level security;
alter table public.bets enable row level security;
alter table public.daily_claims enable row level security;

-- Juegos: lectura pública para todos
create policy "Juegos son visibles para todos"
  on public.games for select
  using (true);

-- Perfiles: el usuario puede ver su propio perfil
create policy "Usuarios ven su propio perfil"
  on public.users for select
  using (auth.uid() = id);

-- Billeteras: el usuario puede ver su propia billetera
create policy "Usuarios ven su propia billetera"
  on public.wallets for select
  using (auth.uid() = user_id);

-- Apuestas: el usuario ve sus propias apuestas
create policy "Usuarios ven sus apuestas"
  on public.bets for select
  using (auth.uid() = user_id);

-- Daily Claims: el usuario ve sus propios reclamos
create policy "Usuarios ven sus reclamos diarios"
  on public.daily_claims for select
  using (auth.uid() = user_id);
