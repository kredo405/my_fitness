# Forma — Telegram-фитнес тренер

Стартовый продукт Telegram Bot + Mini App. Хостинг интерфейса и коротких API-запросов рассчитан на Vercel Hobby; профиль, дневник, тренировки и история чата хранятся в Supabase Postgres. Telegram Mini App initData проверяется на сервере по официальной схеме HMAC и имеет срок годности 24 часа. Долгие фоновые задачи, постоянный процесс и polling здесь не используются.

## Что работает

- Telegram `/start`, `/today`, `/help` и кнопка запуска Mini App через webhook.
- Профиль: цель, опыт, рост/вес, ограничения и доступное оборудование.
- План тренировки на сегодня с адаптацией стартового набора упражнений и отметкой выполнения.
- Дневник самочувствия, стресса, сна, веса, воды, питания и заметок; история последних записей.
- ИИ-чат с короткой историей беседы через OpenRouter; профиль и последние записи передаются выбранной модели.
- Лимит ИИ-чата — до 30 запросов на пользователя в день.
- API не отдаёт ключ Supabase браузеру. RLS включён; таблицы недоступны ролям anon/authenticated, сервер проверяет Telegram initData.
- Для ответа ИИ профиль и последние дневниковые записи передаются выбранному AI-провайдеру. Данные хранятся в Supabase, удалить их можно кнопкой в профиле.

Тренировочный план пока базовый шаблон, а не медицинская оценка или автоматически периодизируемая программа. При боли/ограничениях остановись и уточни безопасную нагрузку у специалиста. ИИ-функция требует отдельный ключ провайдера; без ключа чат честно покажет подсказку настройки.

## Развёртывание через импорт GitHub в Vercel

1. Создай проект Supabase, открой SQL Editor и выполни `supabase/schema.sql`. Возьми Project URL и `service_role` key из API settings. Никогда не помещай service role key в frontend.
2. Создай бота у `@BotFather` командой `/newbot` и скопируй токен.
3. В Vercel нажми **Add New → Project → Import Git Repository** и выбери `kredo405/my_fitness`. Для Production Branch укажи `main`, Root Directory оставь `./`. Исходный код бери из репозитория — загружать папку вручную не нужно.
4. В форме **Configure Project** добавь переменные окружения для **Production** до первого деплоя:

   - `TELEGRAM_BOT_TOKEN` — токен из BotFather.
   - `TELEGRAM_WEBHOOK_SECRET` — случайная строка длиной от 32 символов из латинских букв, цифр, `_` и `-`.
   - `SUPABASE_URL` — Project URL Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — секретный service role key.
   - `OPENROUTER_API_KEY` — необязательно; ключ из кабинета OpenRouter для ИИ-чата.
   - `OPENROUTER_MODEL` — необязательно; slug модели из каталога OpenRouter, по умолчанию `openai/gpt-4o-mini`.
   - `OPENROUTER_BASE_URL` — необязательно; по умолчанию `https://openrouter.ai/api/v1/chat/completions`.

   `APP_URL` пока пропусти: домен проекта станет известен после первого деплоя. Не добавляй секреты в файлы репозитория.

5. Нажми **Deploy**. После подключения GitHub последующие коммиты и push в `main` будут автоматически запускать production-деплой. Ветки кроме `main` Vercel будет собирать как Preview Deployments.
6. После первого Production Deploy скопируй его домен, например `https://my-fitness.vercel.app`. Добавь `APP_URL` с этим значением в **Project Settings → Environment Variables** для **Production** и повторно задеплой Production, чтобы переменная попала в серверную функцию.
7. После повторного Production Deploy подключи Telegram webhook, подставив production-домен и значения секретов. Команду выполни локально в PowerShell; не добавляй токен в репозиторий:

   ```powershell
   $app = "https://YOUR-APP.vercel.app"
   $token = "YOUR-TELEGRAM-BOT-TOKEN"
   $secret = "YOUR-WEBHOOK-SECRET"
   $body = @{ url = "$app/api/telegram"; secret_token = $secret; allowed_updates = @("message") } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body $body
   ```

8. В Telegram открой бота, отправь `/start` и запусти Mini App. Сначала заполни профиль.

## Локальный просмотр

Интерфейс можно посмотреть статическим сервером, но API аутентификации требует реального запуска из Telegram и настройки окружения. Vercel CLI локально поднимает функции после `vercel dev`. Для первого релиза проверь webhook и Mini App на production deployment.

## Переменные окружения

Добавляй секреты в форме импорта/настройки проекта Vercel либо в **Project Settings → Environment Variables**. `APP_URL` вводится после первого деплоя; остальные переменные можно внести при импорте. Для текущего запуска достаточно Production scope; не коммить `.env` и не вставляй service role key в код. Запросы к моделям оплачиваются по тарифу OpenRouter; настрой лимиты расходов в его кабинете.
