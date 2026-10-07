# Rublox user guide

*Version 1.0.0*

Rublox lets you build real phone apps with blocks. You draw the screens, snap blocks together to
tell the app what to do, and try it right away. This guide is for everyone: a parent, a teacher, a
child who can read, an adult who is just starting.

Words in “quotes” are the ones you see on screen. If your interface is in French, read the
[French guide](fr.md) instead.

## Contents

1. [Getting started](#1-getting-started)
2. [Junior and Studio](#2-junior-and-studio)
3. [The editor](#3-the-editor)
4. [Learning](#4-learning)
5. [Accounts and spaces](#5-accounts-and-spaces)
6. [Publishing and testing on a phone](#6-publishing-and-testing-on-a-phone)
7. [Data](#7-data)
8. [Gallery and remix](#8-gallery-and-remix)
9. [AI assistant](#9-ai-assistant)
10. [Game mode](#10-game-mode)
11. [For the administrator](#11-for-the-administrator)
12. [FAQ](#12-faq)

---

## 1. Getting started

### 1.1 What is Rublox?

Rublox is free software (MIT license) that runs in the browser. A family, a school or a club
installs it on its own server: Rublox is **self-hosted**. You cannot just sign up: you need an
**invitation**.

With Rublox you can:

- **draw your screens** by dragging buttons, texts, images, lists, a map… onto a real phone screen;
- **program with blocks** that snap together like bricks;
- **try your app** right away in the preview, then on your phone with a QR code;
- **publish your app**: it gets its own address and installs on the home screen of an Android phone
  or an iPhone;
- **learn step by step** with tutorials, challenges with stars, badges, and a slow motion that
  lights up each block while it runs.

A Rublox app is a **PWA**, a web app that can be installed. Rublox does not build files for the Play
Store or the App Store.

### 1.2 Trying without an account (guest mode)

You do not need an account to start. On the home page, choose “Try without an account” (on the
sign-in page: “Continue without an account”).

In guest mode:

- your projects stay **in this browser**, on this device. The “Guest mode” badge at the top of the
  page reminds you. If you clear the browser’s data, they are gone;
- you can design, program, use the preview, follow the tutorials, and import and export a `.rublox`
  file;
- you cannot test on your phone, share, publish or use the AI assistant: those buttons are greyed
  out, and their tooltip says why (“Not available in guest mode.”);
- shared data and calls to services on the Internet do not work (section 7).

When you later sign in in the same browser, Rublox offers to bring these projects along: “Projects
are waiting in this browser”. Choose “Move into my account” or “Later”.

### 1.3 Signing in

Click “Sign in” at the top right (or on the home page). You can sign in:

- with your “Username or e-mail” and your “Password”, then “Sign in”;
- with “Use a passkey”: your fingerprint, your face or your device code (once you have added one,
  see 5.8).

No account? “Ask a grown-up or the administrator for an invitation.” After five failed tries you
have to wait: “Too many tries. Try again in … min.” A sign-in lasts a year on a device.

### 1.4 The dashboard

This is the “My projects” page. The top bar leads to “My projects”, “Gallery”, “Spaces”, “Learn”
and, for the administrator, “Administration”. In guest mode, only “My projects” and “Learn” are
offered. ([screenshot](../screenshots/j0/dashboard.png))

**Create a project.** “New project”, then a “Project name”. Pick “Blank project” (an empty screen)
or a **template**, a small ready-made app, then “Create from this template”. The templates provided
([screenshot](../screenshots/j6/junior-light-templates.png)):

| Junior | Studio |
|---|---|
| Say hello, Roll the dice, The animal quiz, Who does the dishes?, My sketchbook, Scoreboard, Toothbrush timer, Catch the star | Split the bill, Temperature converter, Shopping list, Tabbed app |

**Other buttons.** “Import” opens a `.rublox` file (see 6.5). “Create with AI” only shows when the
AI assistant is turned on (section 9).

**Search, sort, filter.** “Search a project” filters by name. “Sort”: “Recent first” or “By name”.
The filters “All”, “Favorites” and “Trash” are always there; with an account, “Mine”, “Shared with
me” and “My space” (the projects of members of a space you manage) appear when they are useful.

**On each card**: a thumbnail of the start screen, the date it was edited, the star “Add to
favorites”, and the menu “Actions on …”: open, “Rename”, “Duplicate”, “Delete”.

**The trash.** “Delete” sends the project to the trash. “Projects stay in the trash for 30 days,
then they are gone.” In the “Trash” filter you can “Restore” a project or “Delete forever”.

**The demo app.** From the dashboard, the command palette (Ctrl/Cmd + K, see 3.5) offers “Open the
demo app (every component)”: a project that uses every component, with its blocks.

### 1.5 The home page and the guided tour

The home page shows to a visitor who is not signed in and has not chosen “Try without an account”
yet. It presents Rublox and its two modes.

The first time you open the editor in a mode, a **guided tour** shows you the important places: the
components, the app’s screen, the settings, the blocks, the help. Follow it (“Next”, “Back”,
“Finish”) or click “Skip the tour”. To see it again: “Help”, then “Take the guided tour again”.
([screenshot](../screenshots/j3/junior-light-tour.png))

### 1.6 Language, theme and mode

At the top right of every page:

- the **“Mode”** switch: “Junior” or “Studio” (section 2);
- the **“Interface settings”** button: “Theme” (“Light”, “Dark” or “Automatic”, which follows your
  device) and “Language” (“Français” or “English”).

With an account, these choices are also in “My account”, under “Preferences”: “They follow you on
all your devices.” The command palette has them too (“Switch to Junior mode”, “Dark theme”,
“Interface in French”…).

Changing the interface language does not translate your projects: the texts of your app (a button’s
text, for example) stay in the language the project was created in.

---

## 2. Junior and Studio

Rublox has two interface modes. Everyone picks theirs and can change it at any time. **Changing mode
does not change the project.** Children’s accounts created by a space start in Junior.

| | Junior | Studio |
|---|---|---|
| For | children, beginners | teens, adults, teachers |
| Interface | big buttons, large text, a mascot that guides and cheers, sounds (which can be turned off) | compact, plain |
| Components | a selection | all |
| Properties | the essential ones; the rest under “More options” | all |
| Blocks | rounded, Scratch-like, a selection, simple labels; “More blocks” switch | all |
| Code | hidden; “Show the code” switch | always shown under the preview |
| Selection | one component at a time | several (Shift + click) |
| Console | collapsed at first | open |
| Badges | always shown | can be hidden |

Studio only: the AI, Audio recorder, Battery, Network, Clipboard, Local notifications and Google
sheet components.

**Switching mode**: the “Mode” switch at the top right, the command palette (“Switch to Studio
mode”), or “My account › Preferences”.

In Junior, on a screen narrower than 1,536 pixels, the “Test”, “Share” and “Publish” buttons only
show their icon: hover over them to read their name.

Screenshots: [Design in Junior](../screenshots/j2/design-junior-light.png),
[Design in Studio](../screenshots/j2/design-studio-light.png).

---

## 3. The editor

Open a project from the dashboard. The editor needs a computer or a tablet in landscape. On a phone
it shows “The editor needs a bigger screen”, with a QR code to go on with a computer.

### 3.1 The top bar

From left to right:

- the **logo**: back to the “Dashboard”;
- the **project name**: click it to change it;
- the **“Design”**, **“Blocks”** and **“Data”** tabs, then the **screen picker** (3.2.6);
- **“Undo”** and **“Redo”**;
- the **save state**: “Saving…”, then “Saved”. Rublox saves on its own, all the time. You may also
  see “Offline” (your changes will leave when the connection is back) or “Read-only”;
- the **avatars** of the people in the project (5.13) and the **“Command palette”** magnifier;
- **“History”** (projects of an account only, 5.10) and the **“Project”** menu (exports, 6.5);
- **“Test”** (6.1), **“Share”** (5.11 and section 8) and **“Publish”** (6.2);
- **“Help”**, the **“Mode”** switch and **“Interface settings”**.

### 3.2 The Design tab

This is where you draw your screens: the components and layers on the left, the app’s screen in a
phone frame in the middle, the properties on the right, the console at the bottom.

#### 3.2.1 The component palette

The “Components” palette sorts components by category: Layout, Basics, Input, Display, Lists, Media,
Maps and charts, Sensors, Device, Data, Game. “Search a component” filters the list.

To add a component, **drag it** onto the screen or into a container (Row, Column, Box…): a marker
shows where it will land (“Drop here”). Or select it and press **Enter** (or double-click). On a
tablet, press and hold the component, then drag it with your finger.

**Non-visual components** (Timer, Sound, Location, Vibrator…) are not seen in the app: they go under
the phone, in “Non-visual components”.

The layout is made of boxes (Row, Column, Box, Grid). You can only place a component at an exact
spot inside a game scene (section 10).

#### 3.2.2 Layers

Under the palette, the “Layers” tab shows the tree of the screen’s components. Drag a component to
move it, double-click to rename it, and use its buttons: “Hide in the editor”, “Lock”, duplicate,
delete. With the keyboard: “Space to grab, arrows to move, Alt + arrows to move up or down.”

#### 3.2.3 The canvas

The canvas shows your app’s screen. Click a component to select it; its “Width” and “Height” handles
resize it. The canvas bar picks the “Device” (“Small Android”, “iPhone”, “Tablet”), and lets you
“Rotate”, “Zoom in”, “Zoom out”, “Fit to window”, and open the “App theme”.

#### 3.2.4 The inspector

On the right, “Properties” shows the settings of the selected component:

- “Name”: the name used in blocks (for example Button1). It starts with a letter, has no spaces, and
  is not already taken;
- the settings, grouped into “Content”, “Style”, “Layout” and “Advanced”, each with its own editor:
  colour (with the “Theme colors”), size (“Auto”, “Fill”, px or %), spacing (“All sides” or “Per
  side”), icon, image, sound…;
- “Back to the default value” clears a setting; “Help” opens the component’s sheet;
- in Junior, “More options” shows the less common settings;
- at the bottom, “Duplicate the component” and “Delete the component”.

In Studio, **Shift + click** selects several components: “The settings below change every selected
component.”

#### 3.2.5 App theme and navigation

Click the background of the screen: the inspector shows two tabs, “Screen” and “App”. The “App” tab
sets the **“App theme”**: “Ready-made themes”, “Main color”, “Second color”, “Background”, “Font”,
“Corners”, “Light or dark”. Components take these colours, except the ones you set yourself.
([screenshot](../screenshots/j2/theme-junior-light.png))

It also sets the **“Navigation”**:

- “Stack”: “go to screen” opens a screen on top, the back button comes back;
- “Tabs”: a tab bar at the bottom of the app;
- “Drawer”: a menu that opens from the side with the ☰ button.

For tabs and drawer, choose the “Menu screens”, their name and their icon. Shortcut: the “App theme
and navigation” command.

#### 3.2.6 Screens

The **screen picker** (top bar) lists the screens; the star marks the “Start screen”. At the bottom
of the list: “Add a screen”. The “…” button next to it offers “Rename the screen”, “Make it the
start screen”, “Duplicate”, “Move up”, “Move down” and “Delete”. An app keeps at least one screen.

While the app runs, you change screens with the “go to screen …” and “go back to the previous
screen” blocks (Screens category), or through tabs and drawer.

#### 3.2.7 Images and other files

Next to “Layers”, the “Images” tab lists the project’s images; “Upload an image” adds one (8 MB at
most). Sounds, videos and Lottie animations are uploaded from the inspector of the component that
uses them (“Upload a sound”, “Upload a video”, “Upload a Lottie animation (.json)”). An image can
also come from an `https:` address. With an account, the largest upload and each account’s storage
are set by the administrator.

#### 3.2.8 Copy, paste, undo

- **Copy, cut, paste**: Ctrl/Cmd + C, X, V. You can paste into another screen or another project;
  images come along.
- **Duplicate**: Ctrl/Cmd + D. **Delete**: the Delete key.
- **Undo** and **Redo**: Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z. Everything can be undone, in every
  tab. When several people work together, each one only undoes their own changes.

### 3.3 The Blocks tab

This is where you tell your app what to do: the toolbox on the left, the workspace in the middle,
the live preview on the right (and the code in Studio). Screenshots:
[Junior](../screenshots/j2/blocks-junior-light.png),
[Studio](../screenshots/j2/blocks-studio-light.png).

#### 3.3.1 The toolbox

The **Components** category holds the blocks of the components on the screen, sorted by component:
their events (“when Button1 is clicked”), their properties to read or change (“set text of Text1
to …”) and their actions. Then come the general categories: Control, Logic, Math, Text, Lists,
Variables, Functions, Screens, Interface, Debugging, Colors, Data, Objects, and App.

A few useful blocks: “when the app starts”, “repeat forever”, “wait 1 second(s)”, “print … in the
console”, “show the message …”, “short message …”, “yes or no answer to …”, “answer to the
question …”. The “event value …” block gives what an event brings (the item tapped, the new value…);
it goes inside the “when …” block that provides that value.

Lists start at **1**, as in Scratch.

#### 3.3.2 The workspace

Drag blocks into the workspace and snap them together. Each screen has its own workspace; the screen
picker chooses which one you edit. Right-clicking a block gives its help, breakpoints, duplicate,
delete and, when AI is on, “Explain this block” or “Explain this stack”.

Renaming a component updates its blocks. Deleting it leaves its blocks, flagged: “This component no
longer exists. Pick another one or delete this block.”

In Junior, the toolbox shows a selection of simple blocks. The **“More blocks”** switch above the
workspace shows them all; next to it, “Show the code” shows the code.

#### 3.3.3 The “App” workspace, variables and functions

In the Blocks tab, the screen picker also offers “App (shared by all screens)”. Put there “when the
app starts” (to give variables their starting value) and the **app functions**, which every screen
runs with “call function” or “result of function” (App category). A function made in a screen only
works in that screen. Functions take parameters and can return a value.

The Variables category creates three kinds of variables:

- “Create a variable”: an app variable, “reset when the app starts”;
- “Create a stored variable”: **kept on the phone**, even when the app is closed (a high score, a
  setting);
- “Create a shared variable”: **the same for everyone** who uses the app, kept on the server (needs
  an account, section 7).

#### 3.3.4 Live preview and console

The **preview** really runs your app next to the blocks, and updates on every change. Its buttons:
“Restart the app”, “Stop”, and “App in dark” / “App in light”. An endless loop freezes neither the
app nor the editor: “Stop” stops everything.

The **console**, at the bottom of the editor, receives the messages of “print … in the console”, the
warnings and the errors, written in plain words (“The list only has 3 item(s), and this block asks
for the 5th.”). “Show the block” points to the faulty block; “Clear” empties the console. When AI is
on, the console has a “Why doesn’t it work?” button.

#### 3.3.5 The code view

In Studio, under the preview, the “Code” part shows the JavaScript generated from your blocks. You
can read it but not edit it; “Copy the code” copies it. In Junior, turn on “Show the code”.

#### 3.3.6 Slow motion and breakpoints

**Slow motion** runs the app gently and lights up each block while it runs.
([screenshot](../screenshots/j3/studio-light-slow-motion.png))

- In the preview, click “Turn slow motion on”, then set the “Slow motion speed” (“Slower”,
  “Faster”).
- **Breakpoint**: right-click a block, “Add a breakpoint”. The app is then “Paused on a block”;
  choose “Continue” or “Next block”.
- “Remove all breakpoints” clears them. They are not saved in the project.

#### 3.3.7 The help panel

The “Help” button opens a panel with four tabs: “Blocks” (a sheet for each block, with an example),
“Components” (a sheet for each component, with “Its blocks”), “Glossary” (programming words
explained simply) and “Keyboard” (3.6). “Search the help” searches everything; right-click a block,
then “Help on this block”, to open its sheet. At the bottom: “Tutorials and challenges”, “Take the
guided tour again” and, in Junior, “Turn sounds off”.
([screenshot](../screenshots/j3/junior-light-help.png))

### 3.4 The Data tab

The “Data” tab holds your app’s **tables**, **API connections**, **secrets** and **shared
variables**. Section 7 explains it all.

### 3.5 The command palette (Ctrl/Cmd + K)

Ctrl + K (Cmd + K on a Mac), or the magnifier, opens the “Command palette”: “What do you want to
do?”. Type a few letters, then Enter. It groups:

- **Editor**: “Go to Design”, “Go to Blocks”, “Undo”, “Redo”, “Add a screen”, “Restart the app”,
  “Stop the app”, “Show or hide the console”, “Copy the selection”, “Cut the selection”, “Paste”,
  “App theme and navigation”;
- **Add a component**: “Add: Button”, “Add: Text”…;
- **Project**: “New project”, “Go to the dashboard”, “Open the game demo: Catch the fruit”, “Open
  the game demo: 50 bouncing sprites” and, on the dashboard, “Open the demo app (every component)”;
- **Interface**: change mode, theme and language.

### 3.6 Using the keyboard

“All of Rublox works with the keyboard. Tab moves from one area to the next.” The “Keyboard” tab of
the help gives the full list.

**Everywhere**

| Key | Action |
|---|---|
| Ctrl/Cmd + K | Command palette: every action |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Esc | Close a dialog or a menu |

**Design (palette and layers)**

| Key | Action |
|---|---|
| Enter | In the palette: add the component to the screen |
| ↑ ↓ Home End | In the layers: go from one component to another |
| Space, arrows, Enter | Pick up a component, move it, drop it (Esc cancels) |
| Alt + ↑ ↓ | Move the component up or down |
| F2 | Rename |
| Delete | Delete |
| Ctrl/Cmd + D | Duplicate |
| Ctrl/Cmd + C, X, V | Copy, cut, paste |

**Blocks**

| Key | Action |
|---|---|
| T | Go to the toolbox |
| W | Go to the workspace |
| Arrows | Go from one block or category to another |
| Enter | Place the chosen block, or edit a field |
| M | Move the block (arrows, then Enter to attach it) |
| Shift + M | Move the whole stack |
| Ctrl/Cmd + Enter | Block menu (help, slow motion, delete…) |
| X | Detach the block |
| D | Duplicate the block |
| Delete | Delete the block |
| N, B | Next stack, previous stack |
| Home, End | Start or end of the block |
| I | Say what the block is (screen reader) |
| C | Tidy up the workspace |

In a game scene, other keys place the sprites (10.2).

---

## 4. Learning

The “Learn” page gathers tutorials, challenges and badges. It works in guest mode too.
([screenshot](../screenshots/j3/junior-light-learn.png))

### 4.1 Tutorials

A tutorial guides you step by step in the editor. A bubble points at what to use (“Look here”) and
each step completes on its own once the action is done: a button is placed, a block exists, you
clicked in the preview… “Nice one!”

During a tutorial: “A hint?”, “Pause”, “Quit the tutorial”. Your progress is kept: on the Learn
page, a tutorial you started offers “Resume”, a finished one “Do it again”.

| Junior | Studio |
|---|---|
| My first button, The magic dice, The quiz | Two screens and navigation, The weather, Address book, Map of my places, Family chat |

The weather and Family chat need an account (a service on the Internet, shared data).

### 4.2 Challenges and stars

A challenge gives a “Goal” and a starter project. Rublox checks your work live and gives up to
**three stars**: “One more star!”, then “All three stars! Challenge complete.” A “Hint” helps when
you are stuck. Challenges provided: The counter, The countdown, Heads or tails, A function used
twice.

### 4.3 Badges

| Badge | How to earn it |
|---|---|
| First app | Your app reacts to something: a button, a screen opening… |
| First tutorial | You finished a tutorial. |
| Five tutorials | Five tutorials finished. |
| Round and round | You used a loop. |
| Memory of an elephant | You stored a value in a variable. |
| Home-made function | You wrote a function and called it. |
| Globetrotter | Your app moves from one screen to another. |
| Eagle eye | You watched your blocks in slow motion. |
| Bug hunter | Your app stopped on a breakpoint. |
| Three stars | You got all three stars of a challenge. |
| First publication | Your app is online. |
| First remix | You remixed someone’s app. |

A new badge is announced: “New badge: …”. In Studio, “Hide badges” hides them.

Progress is kept **in this browser**, one per account (and one for guest mode). It does not follow
you to another device yet.

### 4.4 Help and glossary

Every block and every component has a sheet with an example, and the glossary explains programming
words: app, screen, component, property, event, block, variable, loop, condition, function,
parameter, list, preview, console, slow motion, breakpoint, bug, code. See 3.3.7.

---

## 5. Accounts and spaces

### 5.1 The invitation, the only way in

Nobody signs up alone. An account is created with an **invitation link** (from the administrator or
from the manager of a space), or directly by the administrator, or by the manager of a space for a
child or a pupil (5.4).

The link leads to “Welcome to Rublox”. Fill in “Your name”, “Username” (lowercase letters, digits,
“.”, “_” or “-”), “Password” (8 characters or more), “Confirm the password” and, if you like,
“E-mail (optional)”. Rublox never sends e-mails. Then “Create my account”. A link that expired, was
already used or was cancelled shows “This invitation no longer works”.
([screenshot](../screenshots/j1/invite.png))

### 5.2 The first account: the administrator

On the very first start, Rublox creates an administrator from the server settings (section 11), only
if the database has no account yet. The administrator then invites the others.

### 5.3 Spaces: family, class, team

A **space** groups accounts, with **managers** (parents, teachers) and **members**. Three kinds:

- “Family”: “Parents create the children’s accounts.”
- “Class”: “The teacher creates the pupils’ accounts.”
- “Team”: “Adults working together.”

To create one: “Spaces”, then “Create a space”, with a “Kind” and a “Name of the space”. You become
its “Creator”. An account created by a space cannot create a space.

A space’s page has four tabs: “Members”, “Projects”, “Invitations”, “Settings”.
([screenshot](../screenshots/j1/junior-light-space.png))

### 5.4 Children’s accounts, without e-mail

In “Members”, the manager clicks “Create an account”: “No e-mail needed: you choose the username and
the password, and can change it.” The account is ready at once; give the username and password to
the child. These accounts start in Junior.

For an adult who has, or will create, their own account: the “Invitations” tab, “Create an
invitation”, choosing the “Role in the space”.

### 5.5 What managers see and do

A manager:

- sees the members’ projects **read-only** (the “Projects” tab, or the “My space” filter of the
  dashboard);
- on accounts **created by their space**: “Change the password”, “Download their data”, “Delete the
  account”;
- can “Make manager”, “Make plain member”, “Remove from the space”;
- invites adults and sets what members may do (5.6).

A manager cannot touch the password or data of an adult who joined with their own account; that
adult can “Leave the space”. A space keeps at least one manager. To “Delete the space”, first delete
the accounts created in it; the others keep their accounts and projects.

### 5.6 Members’ rights

“Settings” tab, “What members may do”: “Publish their apps”, “Use the AI assistant” (when AI is
installed), “Share in the gallery”.

By default, publishing is allowed in a family and a team, not in a class; AI and gallery are
unticked. These rights only apply to members. A member of several spaces follows **the strictest
rule**: every one of their spaces must allow it.

### 5.7 Profile and avatar

Click your avatar at the top right, then “My account”. The “Profile” part holds your “Display name”,
your “Username”, your “E-mail” (optional) and your “Avatar”: twelve characters drawn for Rublox
(Blue block, Coral block, Mint block, Sun block, Cat, Fox, Bear, Bunny, Frog, Robot, Alien,
Astronaut). No photos. The “Preferences” part sets mode, theme and language.
([screenshot](../screenshots/j1/junior-light-account.png))

### 5.8 Password, devices, passkeys

In “My account”, under “Security”:

- “Change password”: your other devices are signed out. The password of an account created by a
  space is managed by its manager;
- “Passkeys”: “Add a passkey” to sign in without a password, with your fingerprint or your face;
- “Signed-in devices”: “Sign out” a device you do not recognise, or “Sign out the other devices”.

### 5.9 My data: export and deletion

In “My account”, under “My data”:

- “Download my data”: a file with everything Rublox keeps about you (profile, spaces, devices,
  passkey names, projects and versions, files, shares, favourites), with no password and no secret;
- “Delete my account”: your account, your projects, their versions and their files are erased for
  good. Type your password to confirm.

Deletion is refused to an account created by a space (“The manager of your space can download your
data or delete your account.”), to the last administrator, and to the last manager of a space that
still has members.

### 5.10 Version history

With an account, the project lives on the server, and “A version is kept every 10 minutes of work.
Restoring never destroys anything.” In the top bar, “History”:

- “Version name” then “Keep this version” to name one (“before level 2”);
- “Restore”: your current project is first kept in the history, so you can come back to it.

Guest projects have no history.

### 5.11 Sharing a project with another account

Click “Share”. Only the owner shares. Type the other account’s “Username”, choose the “Rights” (“Can
view” or “Can edit”), then “Share”. For each person you can change their rights or remove them.

The project shows up for them under “Shared with me”. With “Can view”, they open it read-only: a
banner says so, they can try it without saving anything, and “Make a copy”. They can also choose
“Stop following this project”.

The same dialog handles sharing in the gallery (section 8).

### 5.12 Giving a project away

In “Share”, a person’s menu: “Give them the project”. “You will become an editor: … will be able to
remove you.” The new owner does not inherit your choices: the AI component of the published app
is switched off again, and the project leaves the gallery, until they decide otherwise.

### 5.13 Editing together

Several accounts can edit a project at the same time; everything merges.
([screenshot](../screenshots/j4b/studio-light-presence.png))

- **Who is here**: the others’ avatars, each in its own colour, in the top bar. Click them: “In the
  project right now” shows each person’s tab and screen, with “Go there”. Someone who can only read
  is marked “Only looking”.
- **What others do**: the component or block stack they picked is outlined in their colour.
- **Conflicts**: blocks sync stack by stack. If two people change the same stack at once, the one
  saved last wins, and the other is told: “Stack changed by …”, with “Show”.
- **Undo** only undoes your own changes.
- **Offline**: keep working; your changes leave when the connection is back and merge with the
  others’. A project already opened on this device reopens even without a network.

---

## 6. Publishing and testing on a phone

Testing and publishing go through the server: you need an account.

### 6.1 Testing on your phone

Click “Test”. “Scan this QR code with your phone’s camera: your app opens and follows each of your
changes.” ([screenshot](../screenshots/j4/junior-light-live.png))

- The link works for **8 hours** (“Works until …”); “Copy the link” to send it another way.
- The dialog shows the state (“Live”…) and how many phones are connected.
- The “Phone console” receives the messages of “print … in the console” and the phone’s errors; they
  also reach the editor’s console, with a badge.
- “New link”: the old one stops and the phones are disconnected (one active link per person and per
  project). “Stop testing” ends the link.

Once the dialog is closed, the “Live test: …” pill in the top bar reopens it. The phone must be able
to reach the Rublox server: an address like `localhost` only works on the computer, and the dialog
says so.

### 6.2 Publishing

Click “Publish”. “Each publication is a frozen version: your next changes do not affect it until you
publish again.” Three tabs:

**“Settings”**

- “App name”: shown under the icon, on the home screen;
- “Address”: 3 to 40 characters (lowercase letters, digits, dashes), for example `my-dice`, which
  gives an address like `https://apps.example.com/a/my-dice/`. **It will not change any more**, even
  with new versions, even if you unpublish;
- “Description” (optional);
- “Icon”: an “Emoji” on an “Icon background colour”, or a “Project image”;
- “Theme colour” (the phone’s bar) and “Start colour” (the background while the app opens);
- if the app uses the AI component: “Allow AI in the published app” (9.5).

Then “Publish” (or “Publish a new version”): “It’s online!”

**“Share”**: the address (“Copy the address”, “Open the app”), the QR code, “Print the QR code” and
“How to install it?”. ([screenshot](../screenshots/j4/junior-light-publish-share.png))

**“Versions”**: “Put back online” an older version, or “Unpublish”: the address will show “This app
is no longer published”. The versions are kept. A project in the trash is offline too.

The owner and the accounts that can edit the project may publish, except a member of a space where
“Publish their apps” is unticked: “Your space does not allow publishing yet: ask your manager.”

### 6.3 Installing the app on a phone

Open the app’s address on the phone, or scan its QR code. The “Install” button explains how.

- **On iPhone or iPad**: open the page in Safari, tap the Share button (the square with an arrow
  pointing up), then “Add to Home Screen” and “Add”.
- **On Android**: open the page in Chrome, tap the ⋮ menu at the top right, then “Install app” (or
  “Add to Home screen”).
- **On a computer**: in Chrome or Edge, click the install icon in the address bar.

### 6.4 Without Internet, and updates

A published app works **offline** once it has been opened once with the Internet (before that:
“Connect to the Internet once to open this app.”). The map, API connections, shared data and AI need
the Internet.

For a new version: “Publish a new version”. The address stays the same, and a phone that opens the
app with the Internet gets the new version straight away.

Stored variables and “In the app” tables stay on the phone; the published app, the phone test and
the exported website each keep their own. Local notifications only show while the app is open;
Android needs the published app, iPhone needs the app installed on the home screen.

### 6.5 Export and import

The “Project” menu in the top bar:

- “Export the project (.rublox)”: “A file to keep, or to import into another Rublox.” It holds the
  project and its files, but neither the secrets nor the rows of shared tables;
- “Export as a website (.zip)”: “A static site to host wherever you want.” Copy the whole folder to
  a static page host (over HTTPS, so it can be installed on a phone). This site does not work
  offline and has no shared data and no AI; an API connection without a secret is called directly by
  the browser, if the service allows it.

To **import** a `.rublox` file: the “Import” button of the dashboard. A file from a newer version is
refused: “This project comes from a newer version of Rublox: update Rublox.”

---

## 7. Data

In the “Data” tab, the left column lists “Tables”, “API connections”, “Secrets” and “Shared
variables”. A project without data offers “Create a table” and “Create an API connection”.

### 7.1 Tables

A table keeps information in rows and columns, like a spreadsheet: contacts, scores, places. “New
table” creates one. ([screenshot](../screenshots/j5/studio-light-table.png))

- **Columns**: “Add a column”, with a name and a “Type”: “Text”, “Number”, “Yes/no”, “Date”,
  “Image”, “Link”. A column’s menu renames it, changes its type, moves it or deletes it.
- **Rows**: “Add a row”, or delete a row.
- **CSV**: “Import a CSV” (the first line names the columns; “Replace the rows” or “Add after them”)
  and “Export as CSV”.

**“Where the rows live”**:

- “In the app”: the rows ship with the app; each phone keeps its own changes. If you later change
  the rows in the Data tab, phones start again from your new rows.
- “Shared”: the rows are on the server, the same for everyone who uses the app (a chat, scores).
  “The app can”: “only read” or “read and change”. The preview, the phone test and the published app
  see the same rows. Needs an account.

Table blocks are in the Data category: “rows of table …”, “rows of … where …”, “number of rows
of …”, “sort … by …”, “… of row … of …”, “add a row to …”, “in …, set … of row … to …”, “delete
from … row …”, “empty table …”, “when table … changes”.

**Binding a component to a table**: a Data list, a Data grid, a Map or a Chart picks its “Table” in
the inspector, then the column for each field (image, title, subtitle, latitude, value…). The canvas
then shows the real rows.

### 7.2 API connections

An API connection fetches information from the Internet: the weather, movies, quotes. “New
connection”, then the “Base address” (for example `https://api.open-meteo.com`; each call adds a
path to it), the “Headers” and the “Parameters sent with each call”.
([screenshot](../screenshots/j5/studio-light-api.png))

**“Try”** calls the connection with a “Method” and a “Path” (for example `/v1/forecast`). The
“Answer” shows **as a tree**: “Click a field to create the block that reads it.” The block is added
to the screen; “See the block” takes you there.

In the Data category, “answer of …” waits for the answer, “call …” sends without waiting. A JSON
answer becomes an **object**: the Objects category reads a field (“… of …”, with a path like
`current.temperature_2m`), builds objects (“new object”, “… with … = …”) and converts JSON text.

Calls go through the Rublox server, which refuses addresses on private networks. Limits: 10 seconds,
2 MB of answer, 120 calls per minute and per project.

### 7.3 Secrets

An API key must never be visible in the app. In “Secrets”, give a “Name” (for example `WEATHER_KEY`)
and a “Value”, then “Add the secret”. In a connection, write `{{secret:WEATHER_KEY}}` instead of the
key (or use “Insert a secret”). “API keys stay on the server, encrypted. Neither the project nor the
published app holds them: the server adds them to each call.” Only their names are shown. At most 30
secrets per project.

### 7.4 Stored and shared variables

A **stored variable** stays on the phone. A **shared variable** has the same value for everyone who
uses the app; you create it in the Blocks tab, Variables category, and the “when shared variable …
changes” block reacts as soon as someone changes it, on any device. In the Data tab, “Shared
variables” shows each one’s “Current value” and can reset it to its starting value.

### 7.5 Maps and charts

- The **Map** can be moved and zoomed, with markers (latitude, longitude, title) set in the
  inspector, with blocks or from a table. Map tiles come from OpenFreeMap (data © OpenStreetMap): it
  needs the Internet. On the canvas, the map is a sketch; the real one shows in the preview and on
  the phone.
- The **Chart** draws “Bars”, a “Line” or a “Pie”, from its own points or from a table.
- The **Google sheet** component (Studio) reads a Google sheet published as CSV.

### 7.6 Limits

- **Guest project**: only “In the app” tables work. API blocks ask you to sign in, a shared table
  only lives in memory (with a warning), and there are no secrets and no “Try”.
- **Exported website**: no shared data; connections without a secret are called directly by the
  browser.
- **Copies**: shared table rows and secrets follow neither “Duplicate” nor a `.rublox` file.
- **Shared data**: 16 KB per value or per row, 5,000 rows per table. An app that writes too fast is
  slowed down (“The app writes to the shared data too fast: slow down a little.”).
- “Try” and changing secrets need the right to edit the project.

---

## 8. Gallery and remix

The **gallery** shows the apps shared by the accounts of this instance. It is for signed-in accounts
only; the administrator can turn it off. ([screenshot](../screenshots/j6/junior-light-gallery.png))

### 8.1 Browsing and trying

Open “Gallery”. You can “Search for an app or a person”, sort by “Recent” or “Popular”, and filter
by “Mode” (“All”, “Junior”, “Studio”). On an app:

- “Try it”: the app really runs in a phone. An app that is not published yet shows its thumbnail and
  can be tried through “See the blocks”;
- “See the blocks”: the editor, read-only, with its preview;
- “Like” / “Unlike”;
- “Remix tree”: where the app comes from, and who remixed it.

### 8.2 Remixing

“Remix” copies the app into your projects (“… (remix)”). Your card keeps the credit: “Remix of …
by …”. Your first remix earns the “First remix” badge.

### 8.3 Sharing in the gallery

In your project, “Share”, then turn on “Share in the gallery”: “Show your app to the whole instance:
everyone can try it, see its blocks and remix it.” Turn it off to take it back. Only the owner can
do this; a member of a space that does not allow it sees “Your space does not allow sharing in the
gallery yet: ask your manager.” Publish the app too (section 6) so people can “Try it” directly.

The administrator can take a project out of the gallery (“Take out of the gallery”): it stays with
its owner but cannot be shared there again.

---

## 9. AI assistant

The assistant only exists if the administrator installed it with a key and turned it on. Otherwise
**no AI button shows anywhere**: that is normal. The assistant relies on Claude, by Anthropic. It
can be wrong: always check in the preview.

### 9.1 Who may use it

- The administrator turns it on and sets a number of questions per account and per day.
- A member of a space may only use it if all their spaces tick “Use the AI assistant”; an account in
  no space may use it as soon as the instance turns it on.
- No AI in guest mode.

The assistant’s panel shows “… question(s) left today.” The counter starts again every day. When it
runs out: “You asked all your AI questions for today. Come back tomorrow!”

### 9.2 Create with AI

On the dashboard, “Create with AI”. Describe your idea (“An app that draws who does the dishes”),
then “Propose an app”. It can take up to a minute.

The **proposal** shows the screens as thumbnails, a summary, and the number of screens, components
and blocks. Choose “Keep this app” (a new project is created; the “App created in your projects.”
message has an “Undo” button that deletes it), “Decline” or “Change my request”. AI always creates a
**new** project; it does not add screens to an open project.
([screenshot](../screenshots/j6/junior-light-ai-proposal.png))

### 9.3 Explain

Right-click a block: “Explain this block” or “Explain this stack”. Above the workspace: “Explain
this screen”. The words fit your mode, Junior or Studio.

### 9.4 Why doesn’t it work?

In the console, “Why doesn’t it work?”: “The assistant reads the console and the blocks of this
screen.” You may write “What you expected (optional)”, then “Find the problem”. “Show the block”
takes you to the block at fault.

### 9.5 The AI component

In Studio, the **AI** component (Data category) gives your app two blocks: “answer of … to …” (write
a text) and “description by … of image …” (describe a photo). Its “instructions” are added to every
request. When it is not available, it answers an empty text and fires “has a problem”.

**Who pays for the questions:**

- in the editor’s preview and the phone test: **the person testing**, from their own quota;
- in the published app: **the project’s owner**, from their quota, **only** if they turned on “Allow
  AI in the published app” in “Publish”; otherwise AI does not work in the published app;
- an exported website has no AI.

### 9.6 What is kept

A journal records who asked, for what use, with which model, how many tokens, and the result. **The
content of questions and answers is never kept.** The assistant’s instructions are suited to
children.

---

## 10. Game mode

Rublox also makes small games: characters that move, fall, bounce and bump into each other.
([screenshot](../screenshots/j7/junior-light-design.png))

### 10.1 The game scene

From the Game category of the palette, place a **Game scene**. It is a stage of fixed size (360 ×
640 by default), scaled up or down to fill its place. The game runs at 60 frames per second and
pauses while the app is hidden. A scene only takes sprites, scene texts and joysticks, and those
only go in a scene.

Coordinates start at the top left corner: x to the right, y **downwards**; a sprite’s x and y give
the position of its centre. Rotation is in degrees, clockwise.

Settings: scene size, “background image”, “edges” (“Stop”, “Bounce”, “Let through”). Blocks: “when …
starts”, “on every frame of …”, “when … is tapped”, “pause …”, “resume …”, “delete every clone
in …”.

### 10.2 Sprites and costumes

A **Sprite** is an image or an emoji in the scene. Place it by dragging it on the canvas, or with
the keyboard: “Arrows: move. Alt + arrows: size. R or Shift + R: rotate. Escape: deselect.”

Its **costumes** are its different pictures: in the inspector, “Costumes”, “Add a costume” with an
“Emoji or letter” or a project picture. The “costume number” starts at 1; “next costume for …” moves
to the next one.

To make it move: “move … … steps”, “move … by x … y …”, “put … at x … y …”, “glide … to x … y … in …
s”, “turn … by … degrees”, “point … towards …”.

### 10.3 Physics, collisions and edges

- “x speed”, “y speed”, “gravity” (the sprite falls), “bounciness (%)”, “can be dragged”;
- “solid”: two solid sprites push each other away and bounce;
- “collision shape”: “Box”, “Circle” or “None”. A hidden sprite touches nothing;
- “when … touches …”: “when Apple touches Basket”, or “when Apple touches the bottom edge”. It fires
  when the contact starts. “… touches …” and “distance from … to …” go inside an “if”;
- a sprite’s “edges”: “Like the scene” (the default), “Stop”, “Bounce”, “Let through”.

### 10.4 Clones

“create a clone of …” makes a copy of the sprite appear, and “when … starts as a clone” runs for
each one. In “when …” blocks, the sprite’s name means the clone concerned: the same blocks drive the
original and every clone. A clone that leaves the scene disappears on its own; at most 300 clones
per scene.

### 10.5 Joystick and scene text

The **Joystick** is driven with a finger; its direction goes from -1 to 1 (“x direction” to the
right, “y direction” downwards): multiply it by a speed to move a sprite. **Scene text** shows a
text, such as a score, in the scene. For sounds, use the Sound component.

### 10.6 The “Catch the fruit” demo

Open the command palette (Ctrl/Cmd + K) and choose “Open the game demo: Catch the fruit”. A complete
game is created, made only of blocks: play it, look at its blocks, change it. The “Catch the star”
template is another starting point.

---

## 11. For the administrator

### 11.1 Installing Rublox

Installation is described in the [README](../../README.md#self-hosting) (“Self-hosting”, with
every environment variable) and the example [`docker/compose.yaml`](../../docker/compose.yaml).
Keep in mind:

- the administrator is created on first start from `RUBLOX_ADMIN_USERNAME` and
  `RUBLOX_ADMIN_PASSWORD`, only if the database has no account;
- `RUBLOX_SECRET` is required in production (at least 32 bytes): the server refuses to start without
  it, or with the example value;
- the AI assistant needs an `ANTHROPIC_API_KEY` on the server, then turning it on in the settings.

### 11.2 The administration pages

The “Administration” link only shows to administrators. Four tabs:
([screenshot](../screenshots/j1/studio-light-admin.png))

**“Accounts”**: the list (“Search an account”) with role, spaces, storage, last sign-in; “Create an
account”. For each account: “Make administrator” or “Remove the administrator role”, “Disable” or
“Enable again”, “Change the password”, “Delete the account”. There must be at least one
administrator.

**“Invitations”**: “Create an invitation” with a note (“For whom?”), the kind of account (“User” or
“Administrator”), a space and the role in it, the “Number of uses” and the expiry (“In 1 day”, “In 7
days”, “In 30 days”, “Never”). **Copy the link at once: it will not be shown again.** The list shows
each invitation’s state (“Active”, “Used”, “Expired”, “Cancelled”) and who used it; “Cancel the
invitation” revokes it.

**“Spaces”**: an overview of the spaces and their managers.

**“Settings”**: “Name of the instance”, “Gallery enabled”, “AI assistant on” and “AI questions per
account and per day” (when a key is installed), “Largest upload (MB)”, “Storage per account (MB)”.
The page also shows the “Disk space” used and, with AI, the “AI journal”: the last 200 questions,
without their content.

---

## 12. FAQ

**Where are my guest projects?** In the browser where you made them, on that device: nowhere else.
Sign in in that same browser and choose “Move into my account”. You can also export them as
`.rublox` files.

**I forgot my password.** Rublox sends no e-mails. If your account was created by a space, ask your
manager to “Change the password”; otherwise ask the administrator. With a passkey, you can still get
in through “Use a passkey”.

**The map says “The map cannot show here”.** The map needs the Internet and a browser that can draw
3D (WebGL). On some networks (school, office) the map tile service may be blocked: the map does not
show, the rest of the app works.

**A sensor or the vibrator does not work on iPhone.** Not every browser can do everything: iPhone
has no vibration for web pages (“This browser cannot do this: Vibrator.”), does not give the battery
level, and asks permission for motion. Each of these components has an “available” property to check
in an “if” block. The full list is in [docs/compatibilite.md](../compatibilite.md) (in French).

**“You refused access to …”** You said no to the camera, the microphone or the location. Allow it in
the browser settings for this site, then try again.

**“Test”, “Share” and “Publish” are greyed out.** You are in guest mode: sign in.

**“Your space does not allow publishing yet”.** Your manager has not ticked “Publish their apps” in
your space’s settings. Ask them.

**I see no AI button.** The assistant is not installed or not turned on, or your space does not
allow it.

**The phone does not open the test link.** The phone must reach the Rublox server: an address like
`localhost` only works on the computer. The link lasts 8 hours; if it expired, ask for a “New link”.

**My app loops and nothing answers.** Click “Stop” in the preview. An endless loop never freezes the
editor.

**I deleted a project, or broke one.** A deleted project stays 30 days in the “Trash”: “Restore”
brings it back. For a mistake inside a project: “Undo” (Ctrl/Cmd + Z) and, with an account,
“History” to “Restore” an older version.

**The editor says “The editor needs a bigger screen”.** The editor is made for computers and tablets
in landscape. On a phone, scan the QR code shown to go on with a computer; the dashboard, the
gallery, the Learn page and published apps work on phones.
