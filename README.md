# POLITEShop

POLITEShop is a third-party client for [POLITEMall](https://politemall.polite.edu.sg/), the Learning Management System (LMS) used by Polytechnics and ITEs in Singapore. It aims to solve quality-of-life issues present in POLITEMall, like inconvenient UX and poor load performance.

## Planned features

**Home page**<br>
✅ Filter modules by semester<br>
⬜ Sort modules by last event date/time<br>
⬜ Display recent events for each module<br>
⬜ Interactive due date calendar heatmap<br>
✅ Auto-rename modules and module codes with Gemini<br>

**Module page**<br>
⬜ Interactive file tree for activities<br>
⬜ Mark all activities in a folder as "seen"<br>
⬜ "Download all attachments" button on HTML activities<br>
⬜ Breadcrumbs<br>
⬜ Views for assignments and quizzes<br>
⬜ Auto-cleaned HTML for HTML activities<br>
⬜ File preview cards on HTML activities<br>
⬜ Auto-cleaned HTML for announcements<br>
⬜ Simple embed activities<br>
⬜ SCORM activities<br>
⬜ Assignment submission<br>
⬜ Quiz submission<br>
⬜ Automatic link to submission page on briefing page (with Gemini)<br>

**Miscellaneous**<br>
⬜ On-visit data syncing with POLITEMall<br>
⬜ Global `ctrl+k` search bar<br>

## How it works

POLITEShop consists of a Chrome extension (`chrome-ext/`) and a webapp (`webapp/`) hosted on [Vercel](https://vercel.com/home). When you visit POLITEMall, the extension

1. Retrieves your POLITEMall credentials: `d2lSessionVal` and `d2lSecureSessionVal` cookies, and `D2L.Fetch.Tokens` JWT from localstorage.
2. Sets the credentials as cookies (`d2lSessionVal`, `d2lSecureSessionVal`, `brightspaceJWT`) on POLITEShop's domain.
3. Replaces the page contents with an `<iframe>` displaying content from the POLITEShop webapp.

The web server uses the POLITEMall / Brightspace credentials to call their respective APIs (`*.polite.edu.sg` / `*.api.brightspace.com`). Data received from the APIs is stored in a Postgres database hosted on [Supabase](https://supabase.com/). Data from the database is used to render the site server-side, contributing to improved load performance.

## Reverse-engineering

To interface with POLITEMall, POLITEShop uses APIs reverse-engineered from the POLITEMall website. The reverse-engineered APIs are being documented on [Postman](https://www.postman.com/haziqs-team/politemall/overview).

## Rationale of features

This section explains UX issues identified in POLITEMall and proposes features to solve them.

### Global search bar

Sometimes, it's tedious and time-consuming to click back and forth between activity folders / pages looking for a specific page (e.g. an assignment brief). A global, keyboard-accessible (e.g. `ctrl+k`) search bar allows users to find what they're looking for faster with zero clicks.

### Due date calendar heatmap

POLITEMall's calendar is tedious to use. Users need to click on each date to view its events (mostly due dates), and other than "unread" indicators, there's no way to know at a glance which dates have events. A calendar heatmap for events would provide more glanceable information (number of events on each date) in a more compact form. A list of event details can be displayed when the user hovers over the corresponding date on the calendar heatmap, minimising the user action required to view event information. A filter can be applied to the calendar heatmap to display only due date events (or other specific event types), making it easier for the user to find the events they're looking for.

### Complete activity tree

POLITEMall's activity tree is sometimes tedious to navigate. When users expand a folder, any previously-expanded folders automatically collapse - there's no way to have two folders open at once, which can be useful for reference. There's also a delay when navigating between folders due to the (slow) opening/closing animation. Furthermore, if users were looking (by clicking) for a specific activity in one of multiple units, they would have to go back to the module page after looking through the folders for one unit, and then click on the next unit and repeat. It would be more convenient if the activity tree allowed multiple folders open at the same time, opened / closed folders instantly, and displayed the activities of all the units in a module together.

### Download from activity tree

Navigating to an activity page to download its attached file(s) is a common action. To make this more convenient, the activity tree could display download buttons (on hover so it doesn't clutter the UI) for activities with downloadable files. This way, (assuming the user starts from a module page,) they don't need to navigate to the specific activity page to download the file(s) they're looking for - they can download the files directly from the activity tree. This minimises the user action required to download files.

### Mark activities in a folder as "seen"

Users sometimes click on multiple activities in a folder one by one for the sole purpose of removing POLITEMall's "unread" indicator. To make this more convenient, folders could have a "mark as seen" button to remove the unread indicator for all activities in the folder (except for uncompleted quizzes / submissions).

### More accessible embeds

POLITEMall doesn't allow users to download embedded video activities, play video activities at faster than 2x speed, or open document previews (i.e. PDFs) in a new tab. Allowing these actions would provide users with greater flexibility in their workflow. Furthermore, it's sometimes inconvenient to click on the "open link in new tab" button on link activities to use or preview the linked site. It would be more convenient to display a preview (i.e. in an iframe) of the linked site on the activity page.

### Activities, quizzes & assignment "views"

It's a little inconvenient for users to view their list of assignments (click on "Assessment" > click on "Assignments") or quizzes (click on "Assessment" > click on "Quizzes"). A one-click flow would be more convenient. A button can be added to toggle the "view" of the side panel, cycling between the activity tree, assignments, and quizzes.

### Breadcrumbs

It's sometimes helpful to have a clear indication of the "file" path of the currently viewed activity. Each part of the breadcrumb could be link for convenient navigation.

### Edit displayed due dates

The due dates displayed on POLITEMall are sometimes inaccurate for the user. For example, a due date could be set for an assignment, and every class taking that module would see the same due date on POLITEMall, but different classes could actually have different due dates (communicated through other channels). To minimise confusion and display accurate information, it might be helpful to allow users to edit the due date displayed to them. The platform would then display all information as if that was the actual due date, but this features doesn't actually change anything else.

### Glanceable recent events

When a user wants to know whether materials have been posted in a module, they have to click into the module (assuming they start from the homepage), and then navigate to an activity folder to check for new materials. Instead, text like "New content: ..." can be shown with modules on the homepage, immediately informing the user without requiring user action. This can be expanded to events like announcements ("New announcement: ...") and due dates ("Due next week: ...") for more convenient access to this information. This text should link to the appropriate page for quick navigation.

### Automatically-renamed modules & codes

The names and codes set for modules on POLITEMall are often difficult to read due to their formatting (e.g. name "PROGRAMMING II(1_PRG2_011850)", code "24S2-1_PRG2_011850"). To make them more human-readable, they could be automatically renamed (e.g. using an LLM for maximum flexibility) to names students would realistically use (e.g. name "Programming II", code "PRG2").

### Automatic links to submission page

Depending on how content is organised on POLITEMall, it's sometimes inconvenient to find the corresponding submission page when a user is on an assignment brief page, or to find a corresponding assignment brief page (there are sometimes multiple) when the user is on a submission page. A link to the submission page could be displayed on each corresponding assignment brief page, and vice versa. This would probably have to use an LLM to identify corresponding pages.

### Semester break countdown

It might be nice to display the number of days / months until the next break starts, or until the current one ends. This text could link to the school's official academic calendar.
