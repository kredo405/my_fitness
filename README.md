# Forma — Telegram-фитнес тренер

Стартовый продукт Telegram Bot + Mini App. Хостинг интерфейса и коротких API-запросов рассчитан на Vercel Hobby; профиль, дневник, тренировки и история чата хранятся в Supabase Postgres. Telegram Mini App initData проверяется на сервере по официальной схеме HMAC и имеет срок годности 24 часа. Долгие фоновые задачи, постоянный процесс и polling здесь не используются.

## Что работает

- Telegram `/start`, `/today`, `/help` и кнопка запуска Mini App через webhook.
- Профиль: цель, опыт, рост/вес, ограничения и доступное оборудование.
- План тренировки на сегодня с адаптацией стартового набора упражнений и отметкой выполнения.
- Дневник самочувствия, стресса, сна, веса, воды, питания и заметок; история последних записей.
- ИИ-чат с короткой историей беседы, передающий профиль и последние записи выбранной модели через OpenAI Responses API.
- Лимит ИИ-чата — до 30 запросов на пользователя в день.
- API не отдаёт ключ Supabase браузеру. RLS включён; таблицы недоступны ролям anon/authenticated, сервер проверяет Telegram initData.
- Для ответа ИИ профиль и последние дневниковые записи передаются выбранному AI-провайдеру. Данные хранятся в Supabase, удалить их можно кнопкой в профиле.

Тренировочный план пока базовый шаблон, а не медицинская оценка или автоматически периодизируемая программа. При боли/ограничениях остановись и уточни безопасную нагрузку у специалиста. ИИ-функция требует отдельный ключ провайдера; без ключа чат честно покажет подсказку настройки.

## Развёртывание

1. Создай проект Supabase, открой SQL Editor и выполни `supabase/schema.sql`. Возьми Project URL и `service_role` key из API settings. Никогда не помещай service role key в frontend.
2. Создай бота у `@BotFather` командой `/newbot` и скопируй токен.
3. Импортируй эту папку как проект Vercel. Настрой переменные окружения для Production и Preview:

   - `APP_URL` — HTTPS адрес деплоя, например `https://forma-example.vercel.app`.
   - `TELEGRAM_BOT_TOKEN` — токен бота.
   - `TELEGRAM_WEBHOOK_SECRET` — случайная строка 32+ символа (латиница/цифры/`_`/`-`).
   - `SUPABASE_URL` — Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — секретный service role key.
   - `OPENAI_API_KEY` — необязательно, ключ модели для ИИ.
   - `OPENAI_MODEL` — необязательно; по умолчанию `gpt-4o-mini`.
   - `OPENAI_BASE_URL` — необязательно; URL совместимого с OpenAI Responses API endpoint, по умолчанию `https://api.openai.com/v1/responses`.

4. Выполни deployment. Проверь, что `APP_URL` совпадает с production URL.
5. Подключи webhook, подставив URL приложения и секрет (запрос выполнить из терминала, не коммитить URL с токеном):

   ```powershell
   $app = "https://YOUR-APP.vercel.app"
   $token = "YOUR-TELEGRAM-BOT-TOKEN"
   $secret = "YOUR-WEBHOOK-SECRET"
   $body = @{ url = "$app/api/telegram"; secret_token = $secret; allowed_updates = @("message") } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body $body
   ```

6. В Telegram открой бота, отправь `/start` и запусти Mini App. Сначала заполни профиль.

## Локальный просмотр

Интерфейс можно посмотреть статическим сервером, но API аутентификации требует реального запуска из Telegram и настройки окружения. Vercel CLI локально поднимает функции после `vercel dev`. Для первого релиза проверь webhook и Mini App на production deployment.

## Переменные окружения

Секреты не включены в репозиторий. Установи их через Vercel Project → Settings → Environment Variables и повторно задеплой после изменения. Запросы к ИИ оплачиваются отдельно по тарифу выбранного провайдера; используй лимиты расходов в кабинете API.

