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
1. Use the `/help` slash command to see a list of commands available to you. Regular users can use `/about` and `/redeem`.
2. Admins can upload new gift codes directly through Discord using the `/upload` slash command. It accepts both `.txt` and `.csv` attachments!
3. **Future Codes**: `/upload` allows you to specify a future month (e.g. `YYYY-MM`), safely holding codes until their designated time.
4. **Auto-Purge**: The bot autonomously checks the database size every 6 hours and will naturally prune the oldest records if it exceeds `DB_MAX_SIZE_MB`.
