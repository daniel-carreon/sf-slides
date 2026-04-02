---
name: google-workspace
description: Google Workspace via gog CLI — Gmail + Calendar for Daniel's accounts
triggers: gmail, calendar, email, correo, eventos, agenda, scheduling, inbox
---

# Google Workspace (gog CLI)

## Accounts

| Account | Services | Use |
|---------|----------|-----|
| `danielcarreong00@gmail.com` | gmail, calendar | Personal — Gmail cleanup, calendar events |
| `daniel@saasfactory.so` | calendar | Business — SaaS Factory calendar |

## Automation Flags

Always use these in cron jobs and scripted contexts:
- `--json` — machine-readable output
- `--no-input` — never prompt for user input
- `--max N` — limit results (default 25 is too many)

## Gmail Commands

```bash
# Search inbox (threads)
gog gmail search "in:inbox newer_than:1d" --account=danielcarreong00@gmail.com --max 10 --json

# Search messages (individual emails, not threads)
gog gmail messages search "in:inbox is:unread" --account=danielcarreong00@gmail.com --max 10 --json

# Search by label
gog gmail search "label:PROMOCIONES newer_than:7d" --account=danielcarreong00@gmail.com --max 50

# List labels
gog gmail labels list --account=danielcarreong00@gmail.com --json

# Archive (remove INBOX label)
gog gmail messages modify <messageId> --remove-labels INBOX --account=danielcarreong00@gmail.com

# Send email (plain text)
gog gmail send --to recipient@example.com --subject "Subject" --body "Text" --account=danielcarreong00@gmail.com

# Send email (multi-line via stdin)
gog gmail send --to recipient@example.com --subject "Subject" --body-file - --account=danielcarreong00@gmail.com <<'EOF'
Message body here.
EOF

# Send email (HTML)
gog gmail send --to recipient@example.com --subject "Subject" --body-html "<p>HTML content</p>" --account=danielcarreong00@gmail.com
```

## Calendar Commands

```bash
# Today's events (personal)
gog calendar events primary --from $(date +%Y-%m-%dT00:00:00) --to $(date +%Y-%m-%dT23:59:59) --account=danielcarreong00@gmail.com --json

# Tomorrow's events (personal)
gog calendar events primary --from $(date -v+1d +%Y-%m-%dT00:00:00) --to $(date -v+1d +%Y-%m-%dT23:59:59) --account=danielcarreong00@gmail.com --json

# Today's events (business)
gog calendar events primary --from $(date +%Y-%m-%dT00:00:00) --to $(date +%Y-%m-%dT23:59:59) --account=daniel@saasfactory.so --json

# Create event
gog calendar create primary --summary "Title" --from 2026-03-01T10:00:00 --to 2026-03-01T11:00:00 --account=danielcarreong00@gmail.com
```

## Gmail Cleanup Pattern (cron job)

1. Search each low-value label in inbox:
   - `in:inbox label:PROMOCIONES newer_than:7d`
   - `in:inbox label:NEWSLETTERS newer_than:7d`
   - `in:inbox label:NOTIFICACIONES newer_than:7d`
2. Archive each message (remove INBOX label)
3. Count remaining inbox: `gog gmail search "in:inbox" --max 1 --json` (check total)
4. Return empty string if normal, alert if inbox > 20 or error

## Rules

- NEVER send email without Daniel's explicit approval
- NEVER delete emails — only archive (remove INBOX label)
- Confirm destructive calendar actions (delete, modify existing events)
- Use `--account` flag on every command — never rely on defaults
