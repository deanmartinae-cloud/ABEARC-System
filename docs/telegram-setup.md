# Telegram weather alerts

The bot runs on the existing ABEARC server using long polling. No extra hosting, public webhook, Telegram Premium, or paid broadcasts are required. Existing internet and electricity costs still apply.

1. Create a bot with Telegram's @BotFather using `/newbot`.
2. Open **Settings → Telegram Integration** as a superadmin or system admin. Paste the bot token in the password field and click **Save & connect**. ABEARC verifies it with Telegram, stores it encrypted in the persistent data folder, and connects automatically without restarting.
3. Keep the token private. The saved token is never returned to the browser or written to activity logs. Other users need the Telegram privileges assigned through User Management.
4. Test the bot connection, then generate a registration code. Add the bot to the intended chat and send the displayed `/abearc_register CODE` command there. For a channel, grant the bot permission to post.
5. Use **Test send** to verify the destination. Under **Weather alert routing**, select the chat and an enabled weather alert rule, then add the route. Configure weather thresholds in the station dashboard first if no rules are available.

The bot checks weather alert events every minute, queues active alerts, and optionally sends cleared messages. Repeated checks do not resend the same state; a new alert after resolution can be sent again. Newly added routes can send currently active alerts. Delivery history shows queued, retried, sent and failed messages.

The server must remain running and have internet access. Run only one polling server per bot token. Weather alerts depend on station synchronization and the configured weather rules; Telegram does not change those thresholds.

For backups, keep `.telegram-credential.enc` and `.telegram-credential.key` together in the data folder; losing the key prevents recovery. Existing `TELEGRAM_BOT_TOKEN` environment configuration remains supported, but a saved token takes precedence.

Telegram documentation: https://core.telegram.org/bots and https://core.telegram.org/bots/faq
