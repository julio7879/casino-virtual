# 👑 Nogal Casino Royale - Casino Virtual

Un casino virtual de alta gama desarrollado con **Next.js 16**, **Tailwind CSS v4**, soporte para backend en **Supabase** y listo para despliegue en **Vercel**.

Incluye **10 juegos de casino completos e interactivos**, efectos de sonido con Web Audio API (sin archivos de audio externos que fallen), sistema de billetera virtual, rachas de bonos diarios y modo demo/invitado para jugar al instante sin barreras.

---

## 🎮 Catálogo de 10 Juegos Disponibles

1. **🚀 Crash Rocket**: Multiplicador exponencial en tiempo real (1.00x - 1,000x) con gráfico Canvas y retiro manual o automático.
2. **💣 Minas del Faraón**: Buscaminas de casino en cuadrícula 5x5 con 1 a 24 minas configurables y multiplicadores crecientes.
3. **🎡 Ruleta Royale 3D**: Ruleta europea con tapete interactivo, apuestas a plenos (35:1), docenas, columnas, rojo/negro y par/impar.
4. **🃏 Blackjack 21 Pro**: Mesa clásica contra el croupier con reglas europeas, reparto animado, opciones de Pedir, Plantarse y Doblar (Blackjack paga 3:2).
5. **🎰 Neon Fruits 777**: Tragamonedas de 5 rodillos y 5 líneas de pago con símbolos neón, comodines WILD y sietes de la suerte.
6. **⚪ Plinko Pachinko**: Tablero de clavijas piramidal con física de rebote en tiempo real, niveles de riesgo (Bajo, Medio, Alto) y multiplicadores hasta 1,000x.
7. **🎴 Video Poker Jacks or Better**: Póker de descarte a 5 cartas con función para retener cartas (HOLD) y evaluador automático de manos.
8. **🎲 Dados Hi-Lo Royale**: Par de dados 3D con predicciones de Menor a 7, Siete Exacto, Mayor a 7, Dobles y sumas exactas.
9. **👑 Baccarat Punto y Banca**: Mesa VIP de estilo Macau/Monte Carlo con apuestas a Punto, Banca o Empate y regla de la 3ª carta.
10. **🎯 Mega Wheel Fortuna**: Gran rueda de 54 casillas con multiplicadores 1x, 2x, 5x, 10x, 20x, 40x y casilla JACKPOT.

---

## 🚀 Inicio Rápido Local

1. Instala dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ☁️ Conexión con Supabase (Opcional para Modo Online)

El casino funciona **de inmediato en Modo Invitado / Demo** sin necesidad de base de datos. Si deseas activar autenticación y persistencia en la nube:

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** de tu panel de Supabase y ejecuta el archivo [`supabase-schema.sql`](./supabase-schema.sql) incluido en la raíz de este proyecto.
3. Copia tus credenciales en un archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

---

## 🌐 Despliegue en Vercel

1. Sube tu código a un repositorio en **GitHub**:
   ```bash
   git add .
   git commit -m "feat: casino virtual con 10 juegos y supabase"
   git push origin main
   ```
2. Importa el repositorio en [Vercel](https://vercel.com/new).
3. Añade las variables de entorno en la sección **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL`
4. Presiona **Deploy**. ¡Tu casino estará en línea en menos de 2 minutos!

---

## 🛡️ Juego Responsable
Solo para mayores de 18 años. Esta plataforma es una simulación virtual de entretenimiento. Las fichas no tienen valor monetario real ni pueden canjearse por dinero en efectivo.
