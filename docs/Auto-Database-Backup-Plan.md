# Automated Database Backup & Download Plan

## 800 CarGuru — Daily Backup to Local PC

**Date:** April 2, 2026
**Server:** SMF_NEW_CG (Ubuntu 24.04, MariaDB)
**Server IP:** 13.220.57.16
**Database:** carguru2
**Local Destination:** D:\DB_BKP\

---

## Overview

```
┌──────────────────┐     2 AM Daily      ┌──────────────────┐
│                  │ ──────────────────▶  │                  │
│   VPS Server     │   mysqldump + gzip   │  /home/ubuntu/   │
│   (MariaDB)      │                      │  DB_BKP/         │
│                  │                      │                  │
└──────────────────┘                      └────────┬─────────┘
                                                   │
                                          3 AM Daily (SCP)
                                                   │
                                          ┌────────▼─────────┐
                                          │                  │
                                          │  D:\DB_BKP\      │
                                          │  (Local PC)      │
                                          │                  │
                                          └──────────────────┘
```

### Daily Schedule

| Time | Action | Where |
|------|--------|-------|
| 2:00 AM | Database dump + compress | VPS Server |
| 3:00 AM | Download latest backup via SCP | Local PC |

---

## Part 1: Server-Side Setup

### Step 1.1: Create Backup Directory

```bash
mkdir -p /home/ubuntu/DB_BKP
```

### Step 1.2: Create Backup Script

```bash
sudo nano /home/ubuntu/db_backup.sh
```

Paste:

```bash
#!/bin/bash

# ============================================
# DAILY DATABASE BACKUP SCRIPT
# Runs at 2 AM via cron
# ============================================

BACKUP_DIR="/home/ubuntu/DB_BKP"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="/var/log/db_backup.log"

mkdir -p $BACKUP_DIR

echo "$(date) - Starting backup..." >> $LOG_FILE

# Dump and compress
mysqldump -u root carguru2 | gzip > "$BACKUP_DIR/carguru2_$DATE.sql.gz"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_DIR/carguru2_$DATE.sql.gz" | cut -f1)
    echo "$(date) - Backup completed: carguru2_$DATE.sql.gz ($SIZE)" >> $LOG_FILE
else
    echo "$(date) - ERROR: Backup failed!" >> $LOG_FILE
fi

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "$(date) - Old backups cleaned up" >> $LOG_FILE
```

### Step 1.3: Set Permissions

```bash
sudo chmod +x /home/ubuntu/db_backup.sh
```

### Step 1.4: Create Log File

```bash
sudo touch /var/log/db_backup.log
sudo chmod 666 /var/log/db_backup.log
```

### Step 1.5: Schedule Cron Job (Daily 2 AM)

```bash
sudo crontab -e
```

Add:

```
0 2 * * * /home/ubuntu/db_backup.sh
```

### Step 1.6: Test Manually

```bash
sudo /home/ubuntu/db_backup.sh
ls -lh /home/ubuntu/DB_BKP/
cat /var/log/db_backup.log
```

### Server-Side Checklist

- [x] Backup directory created
- [x] Backup script created and executable
- [x] Log file created
- [x] Cron job scheduled at 2 AM
- [x] Manual test successful

---

## Part 2: Local PC Setup (Windows)

### Step 2.1: Prerequisites

- [x] SSH key file: `D:\DB_BKP\id_rsa_new.pem`
- [x] Git Bash installed (provides SCP): `C:\Program Files\Git\`
- [x] Destination folder: `D:\DB_BKP\`

### Step 2.2: Fix SSH Key Permissions (One-Time)

Run in **PowerShell as Administrator**:

```powershell
icacls "D:\DB_BKP\id_rsa_new.pem" /inheritance:r /grant:r "ABC:R"
icacls "D:\DB_BKP\id_rsa_new.pem" /remove "NT AUTHORITY\Authenticated Users"
icacls "D:\DB_BKP\id_rsa_new.pem" /remove "BUILTIN\Users"
icacls "D:\DB_BKP\id_rsa_new.pem" /remove "Everyone"
```

### Step 2.3: Create Download Script

Create file: `D:\DB_BKP\download_backup.bat`

```bat
@echo off

REM ============================================
REM DAILY DATABASE BACKUP DOWNLOAD
REM Downloads latest backup from VPS to local PC
REM Uses Git Bash SCP
REM ============================================

set KEY=D:\DB_BKP\id_rsa_new.pem
set SERVER=ubuntu@13.220.57.16
set DEST=D:\DB_BKP\
set LOG=%DEST%download_log.txt
set SCP="C:\Program Files\Git\usr\bin\scp.exe"
set SSH="C:\Program Files\Git\usr\bin\ssh.exe"

echo ---------------------------------------- >> "%LOG%"
echo %date% %time% - Starting download... >> "%LOG%"

REM Get latest filename from server
%SSH% -i "%KEY%" %SERVER% "ls -t /home/ubuntu/DB_BKP/*.sql.gz | head -1" > "%DEST%latest.txt"

set /p LATEST=<"%DEST%latest.txt"

REM Download only the latest backup
%SCP% -i "%KEY%" %SERVER%:%LATEST% "%DEST%"

if %ERRORLEVEL% EQU 0 (
    echo %date% %time% - Download successful: %LATEST% >> "%LOG%"
) else (
    echo %date% %time% - Download FAILED >> "%LOG%"
)

del "%DEST%latest.txt" 2>nul

echo ---------------------------------------- >> "%LOG%"
```

### Step 2.4: Test Manually

- Double-click `download_backup.bat`
- Check `D:\DB_BKP\` for the `.sql.gz` file
- Check `D:\DB_BKP\download_log.txt` for success message

### Local PC Checklist

- [x] Download script created
- [x] Key permissions fixed
- [x] Manual test successful
- [x] Latest backup file downloaded to D:\DB_BKP\

---

## Part 3: Windows Task Scheduler Setup

### Step 3.1: Open Task Scheduler

- Press `Win + S` → search **Task Scheduler** → Open

### Step 3.2: Create New Task

1. Click **Create Basic Task**
2. **Name:** `CG2 DATABASE BACKUP`
3. **Description:** `Downloads daily database backup from VPS to D:\DB_BKP\`
4. Click **Next**

### Step 3.3: Set Trigger

1. Select **Daily**
2. **Start time:** `3:00:00 AM`
3. **Recur every:** `1` day
4. Click **Next**

### Step 3.4: Set Action

1. Select **Start a program**
2. **Program/script:** Browse to `D:\DB_BKP\download_backup.bat`
3. Click **Next**

### Step 3.5: Finish and Configure

1. Click **Finish**
2. Right-click the new task → **Properties**
3. **General** tab:
   - Select: **Run only when user is logged on**
   - Check: **Run with highest privileges**
4. **Settings** tab:
   - Check: **Run task as soon as possible after a scheduled start is missed**
   - Check: **If the task fails, restart every** → `10 minutes`
   - Set: **Attempt to restart up to** → `3` times
5. Click **OK**

### Task Scheduler Checklist

- [x] Task created: `CG2 DATABASE BACKUP`
- [x] Trigger set to daily 3 AM
- [x] Action points to download_backup.bat
- [x] Run only when user is logged on: enabled
- [x] Run with highest privileges: enabled

---

## Verification & Monitoring

### Daily Checks (First Week)

**On VPS:**
```bash
# Check backup exists
ls -lh /home/ubuntu/DB_BKP/

# Check backup log
tail -10 /var/log/db_backup.log
```

**On Local PC:**
- Open `D:\DB_BKP\` — new `.sql.gz` file should appear daily
- Check `D:\DB_BKP\download_log.txt` for success entries

### Weekly Checks (Ongoing)

| Check | How | Expected |
|-------|-----|----------|
| Backups on VPS | `ls /home/ubuntu/DB_BKP/` | 7 files (last 7 days) |
| Backup log | `cat /var/log/db_backup.log` | No errors |
| Local backups | Open `D:\DB_BKP\` | Files downloading daily |
| Download log | Open `download_log.txt` | No failures |
| Disk space (VPS) | `df -h` | Not filling up |
| Disk space (local) | Check D: drive | Not filling up |

---

## Troubleshooting

### Backup not created on VPS

```bash
# Check cron is running
sudo systemctl status cron

# Check cron log
grep "db_backup" /var/log/syslog | tail -5

# Run manually to see errors
sudo /home/ubuntu/db_backup.sh
```

### Download fails on local PC

| Issue | Solution |
|-------|----------|
| "Permission denied" | Check key file path and permissions |
| "error in libcrypto" | Re-export key from MobaKeyGen as OpenSSH format |
| "Connection refused" | Check server is running, check IP |
| "Host key verification" | Run SCP manually once to accept the key |
| Task doesn't run | Check Task Scheduler history for errors |
| "User account restriction" | Set task to "Run only when user is logged on" |
| PC was off at 3 AM | Enable "Run task as soon as possible after a scheduled start is missed" |

### Restore from backup

```bash
# Upload backup to server (from Git Bash)
"C:\Program Files\Git\usr\bin\scp.exe" -i "D:\DB_BKP\id_rsa_new.pem" "D:\DB_BKP\carguru2_2026-04-02.sql.gz" ubuntu@13.220.57.16:/tmp/

# On server — restore
gunzip /tmp/carguru2_2026-04-02.sql.gz
sudo mysql -e "DROP DATABASE carguru2; CREATE DATABASE carguru2;"
sudo mysql carguru2 < /tmp/carguru2_2026-04-02.sql
```

---

## Local Backup Cleanup (Optional)

To avoid filling up your D: drive, add this line before the last line in `download_backup.bat`:

```bat
REM Delete local backups older than 30 days
forfiles /P "D:\DB_BKP" /S /M *.sql.gz /D -30 /C "cmd /c del @file" 2>nul
```

---

## Summary

| Component | Location | Schedule | Retention |
|-----------|----------|----------|-----------|
| Database dump | VPS `/home/ubuntu/DB_BKP/` | Daily 2 AM | 7 days |
| Local download | `D:\DB_BKP\` | Daily 3 AM | Latest only |
| Backup log | VPS `/var/log/db_backup.log` | Continuous | — |
| Download log | `D:\DB_BKP\download_log.txt` | Continuous | — |

---

## Quick Reference

| Item | Value |
|------|-------|
| Server IP | `13.220.57.16` |
| SSH Key | `D:\DB_BKP\id_rsa_new.pem` |
| SSH User | `ubuntu` |
| Database | `carguru2` |
| SCP Tool | `C:\Program Files\Git\usr\bin\scp.exe` |
| SSH Tool | `C:\Program Files\Git\usr\bin\ssh.exe` |
| VPS Backup Path | `/home/ubuntu/DB_BKP/` |
| Local Backup Path | `D:\DB_BKP\` |
| VPS Backup Script | `/home/ubuntu/db_backup.sh` |
| Local Download Script | `D:\DB_BKP\download_backup.bat` |
| Task Scheduler Name | `CG2 DATABASE BACKUP` |
| VPS Cron Time | 2:00 AM daily |
| PC Download Time | 3:00 AM daily |
| VPS Retention | 7 days |
| Local Retention | 30 days (optional) |

---

**Document Version:** 2.0
**Last Updated:** April 2, 2026
