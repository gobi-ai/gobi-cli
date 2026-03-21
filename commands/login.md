---
name: login
description: Log in to Gobi via Google OAuth
argument-hint: ""
---

Always use the globally installed `gobi` binary (not via npx or ts-node).

Log the user in to Gobi using device code flow:

1. Run `gobi auth login` as a **background task** (use run_in_background).
2. Poll the task output every 2 seconds until the login URL appears in stdout.
3. Extract the URL and display it to the user as a clickable markdown link: `[Click here to log in to Gobi](<url>)`. Also show the user code separately.
4. Tell the user to open the link in their browser and approve the login.
5. Continue polling the background task until it exits (success or failure).
6. On success, confirm the user is now logged in.
7. On failure, show the error and suggest retrying.
