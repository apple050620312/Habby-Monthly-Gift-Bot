# Monthly Gift Bot for Habby Games

## About
Original developed by **Reformed(mayvary)**, but he deleted his Discord and GitHub account.

Currently using by Survivor.io, SOULS, Archero2, Wittle Defender

Maintaining by **sangege**, contact me through [Discord](https://discord.com/users/523114942434639873) or create an issue.

## Bot always said captcha failed / don't work?
Update the code to newest version by downloading main branch.

If after updated it still doesn't work, contact me to debug.

## Bot can't do reset or backup by using the command?
The bot no longer uses text commands! Please use the Discord Slash Commands like `/reset`, `/backup`, `/status` and `/upload` instead.

Server supports 100MB file limit for bot to upload database backups.

## .env
```
TOKEN: Create a Discord bot and get the token
CLIENT_ID: Copy the bot's Client ID
GUILD_ID: Copy the guild's ID
LOG_CHANNEL_ID: Bot will send redeem logs in this channel ID
GAME_STATUS: Fill in the game's name so bot will display the activity
API_HOST: For example Survivor.io is `mail.survivorio.com`, SOULS is `mail.soulssvc.com`
DEVELOPER_IDS: Comma separated list of Discord User IDs with full developer access
DB_MAX_SIZE_MB: (Optional) Max Database Size in MB (1MB = 1,000,000 bytes). Auto-purges old data if exceeded. Default 100.
```

## Setup
```
cp example.env .env
npm install
npm start
```

## Usage & Features
## Command Reference

### Normal User Commands
- `/redeem [code]`: (Optional string). Triggers the secure, ephemeral claim flow. If a code is provided, it tries to claim that specific code. Otherwise, it pulls from the monthly code pool.
- `/about`: Shows bot ping, latency, and developer credits.
- `/help`: Lists available commands.

### Admin Commands (Grouped)
Admin commands are grouped by function and restricted to users with the **Administrator** permission or listed in `DEVELOPER_IDS`.

#### 1. Code Lifecycle Management (`/codes`)
- **`/codes upload [file] [type] [month]`**: Bulk upload gift codes from a `.txt` or `.csv` file. You can attach a future month (e.g. `2024-05`) for them to unlock.
- **`/codes remove [type] [month]`**: Clean up unused codes by month if a mistake was made during upload. Keeps claimed code history intact.
- **`/codes get`**: Fetches a single unused code directly for manual distribution.

#### 2. Interactive Buttons (`/button`)
- **`/button monthly [channel] [message] [label]`**: Posts the primary claim button for users to get random monthly codes.
- **`/button custom [channel] [message] [codes]`**: Posts specific claim buttons that you manually type out (comma-separated). 

#### 3. System Health (`/system`)
- **`/system status`**: Checks API/WS latency, Database read time, Database file size, and provides a statistical breakdown of how many codes remain active.
- **`/system backup`**: Sends a downloadable copy of `database.sqlite` directly to the channel.

#### 4. Audit & Lookup (`/lookup`)
- **`/lookup user [@User | Discord ID]`**: Shows the claim history of a specific Discord account.
- **`/lookup id [Player ID]`**: Shows the claim history of a specific game Player ID.
