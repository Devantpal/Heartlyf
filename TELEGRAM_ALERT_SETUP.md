# Heartlyf Telegram + GPS Alert Setup

The bot token must not be hardcoded in frontend files. Set it in Firebase Functions config or as a secret/environment variable.

## Configure Telegram

1. Keep `telegramChatId` in Firebase at:
   `/settings/esp32_001/notifications/telegramChatId`

2. Set the bot token for Cloud Functions:

```bash
firebase functions:config:set telegram.token="YOUR_BOT_TOKEN"
firebase deploy --only functions
```

For newer Firebase secret-based deployments, set `TELEGRAM_BOT_TOKEN` in the Functions environment instead.

## Manual Database Trigger

Writing this manually will create an alert and send Telegram:

```json
/vitals/esp32_001/latest
{
  "bpm": 135,
  "spo2": 98,
  "ecg": 512,
  "rhythm": "Tachycardia",
  "timestamp": 1710000000000
}
```

The function checks thresholds in:

`/settings/esp32_001/thresholds`

## GPS Coordinates

The patient dashboard writes live location to:

`/gps_tracking/esp32_001/latest`

Alerts use the latest GPS record and include a Google Maps link in Telegram.
