# Tailscale Setup Guide for Team Members

This guide will help you connect to our team's private network using Tailscale.

## What is Tailscale?

Tailscale creates a secure private network between devices, regardless of where they are physically located. Once set up, you'll be able to access team resources like `gg-macstudio:6101` as if you were on the same local network.

---

## Step 1: Download and Install Tailscale

### For macOS:
1. Go to [https://tailscale.com/download/mac](https://tailscale.com/download/mac)
2. Download the app from the **Mac App Store** (recommended) or direct download
3. Open the downloaded file and drag Tailscale to your Applications folder
4. Launch Tailscale from Applications

### For Windows:
1. Go to [https://tailscale.com/download/windows](https://tailscale.com/download/windows)
2. Download and run the installer
3. Follow the installation prompts

### For Linux:
1. Go to [https://tailscale.com/download/linux](https://tailscale.com/download/linux)
2. Follow the instructions for your distribution

---

## Step 2: Sign In and Join the Network

1. Click the **Tailscale icon** in your menu bar (macOS) or system tray (Windows)
2. Click **"Log in"** or **"Connect"**
3. A browser window will open
4. **IMPORTANT**: Sign in using the invite link Matt provides, or ask Matt to add your email to the Tailscale network
5. After signing in, you'll see a prompt to join the network - click **"Connect"**

---

## Step 3: Verify Your Connection

Once connected, the Tailscale icon should show as "Connected" (not "Disconnected").

### Install the Command Line Tool (macOS):

1. Click the Tailscale icon in the menu bar
2. **Hold down the Option (⌥) key** while the menu is open
3. Click **"Install CLI..."** when it appears
4. Enter your password if prompted

### Verify in Terminal:

```bash
tailscale status
```

You should see a list of devices including:
- Your own machine
- `gg-macstudio` (Matt's Mac Studio)
- Other team members' machines

---

## Step 4: Test the Connection

### Test with Tailscale ping:
```bash
tailscale ping gg-macstudio
```

You should see: `pong from gg-macstudio (100.90.49.63) via ...`

### Test the web app:
Open your browser and go to:
```
http://gg-macstudio:6101
```

You should see the Orchestrator AI web application.

---

## Troubleshooting

### "tailscale: command not found"
The CLI isn't installed. Either:
- Use the Option-click menu method above, OR
- Install via Homebrew: `brew install tailscale`

### Can't reach gg-macstudio
1. Make sure Tailscale shows "Connected" in the menu bar
2. Try `tailscale ping gg-macstudio` - if this works but browser doesn't, it may be a firewall issue on your machine
3. Check if your firewall is blocking outgoing connections

### "tailscale status" shows device as "offline"
The target device may be asleep or Tailscale isn't running on it. Contact Matt.

### Connection is slow
Tailscale tries to establish direct connections, but sometimes routes through relay servers. Run:
```bash
tailscale ping gg-macstudio
```
If it says "via DERP(ord)" or similar, it's using a relay. This is normal for some network configurations.

---

## macOS Firewall Settings (If Needed)

If you have the macOS firewall enabled and are having connection issues:

1. Go to **System Settings → Network → Firewall**
2. Click **Options...**
3. Make sure **"Block all incoming connections"** is OFF
4. You can also add Tailscale to the allowed apps list

---

## Quick Reference

| Resource | Address |
|----------|---------|
| Mac Studio Web App | `http://gg-macstudio:6101` |
| Mac Studio Tailscale IP | `100.90.49.63` |

---

## Need Help?

Contact Matt if you:
- Need an invite to join the Tailscale network
- Can't connect after following these steps
- Need access to additional resources

---

*Last updated: December 29, 2025*
