# **The Forum PRD**

# **1\. Overview**

## **1.1 Problem**

Students struggle to discover relevant campus events because information is scattered across listservs, group chats, and social media. They hear about things too late, miss events they'd actually care about, and have no way to know if their friends are going.

As a result, students miss experiences that would have mattered to them, and organizations pour effort into events that never reach the right people.

## **1.2 Solution**

Build a centralized campus event discovery platform that:

* Allows student organization leaders to create and publicize events  
* Personalizes event discovery using algorithmic recommendations  
* Lets students track events they want to attend  
* Shows students which events their friends are attending

---

# **2\. Goals & Non-Goals**

## **2.1 Goals (MVP)**

* Enable event creation and discovery  
* Deliver a personalized, algorithm-driven event feed based on user’s:  
  * Demographics  
  * Interest tags  
  * Frequented campus regions  
  * Time proximity (i.e. days until event)  
  * Friend RSVPs  
  * Following organizations (optional for MVP)  
* Allow basic social interaction (friends \+ RSVPs)

## **2.2 Non-Goals (Out of Scope for MVP)**

* Mobile app  
* Private event coordination  
* Advanced analytics dashboard

---

# **3\. Target Users**

### **Primary Users**

* Undergraduate students  
* Student organization leaders

### **Secondary Users**

* Graduate students  
* Campus departments hosting events

---

# **4\. Core User Flows**

### **4.1 Discover Events**

Landing → Sign up → Onboarding → Explore Feed → RSVP/Save Event → Export to GCal

### **4.2 Create Event**

Sign in → Create Event → Add details/tags/location → Publish → View engagement

### **4.3 Social Interaction**

Search friend → Send request → See events friends RSVP’d to

---

# **5\. Functional Requirements**

![][image1]  
**Key:**

**P0:** MVP requirement  
**P1:** Nice to have  
**P2:** It’s a stretch  
**Grey:** Deprioritized for first release

## **5.1 Landing Page**

Purpose: Convert visitors to users.

Requirements:

* **P0:** Sign up / Log in CTA  
* **P1:** Organizer CTA (“Post an Event”)  
* **P2:** Static preview of event feed

---

## **5.2 Onboarding**

Purpose: Generate initial personalization signals.

Requirements:

* **P0:** Collect interest tags (multi-select)  
* **P0:** Demographic inputs (class year, major, frequented campus regions)  
* **P0:** Organization leadership status  
* **P0:** Store selected interests in user profile  
* **P0:** Feed ranking should incorporate interest match

Exit Criteria: User is redirected to Explore page after completion.

---

## **5.3 Explore Page** {#5.3-explore-page}

Default logged-in homepage.

Requirements:

* **P0:** Personalized event feed, based on:  
  * All onboarding inputs  
  * Site navigation/interaction activity  
  * Time and location of upcoming events  
* **P0:** Search bar, filters, upper bar, and sidebar  
* Event cards display:  
  * **P0:** Title  
  * **P0:** Organization name  
  * **P0:** Date/time  
  * **P0:** Location  
  * **P0:** Tags  
  * **P0:** RSVP count  
  * **P0:** Friends RSVP’d  
  * **P1:** Share link  
  * **P1:** Trolling report button (textbox submission to TigerApps team)  
  * **P2:** Recommendation criteria (friend attendance, interest alignment, etc.)  
  * Follow organization button  
* Users can:  
  * **P0:** RSVP (visible to friends)  
  * **P0:** Save (private)  
  * **P1:** Export event to GCal

---

## **5.4 Upper Bar Components**

### **Search & Filtering**

Requirements:

* **P0:** Keyword search bar (title \+ description)  
* **P0:** Filters:  
  * Tags (free food, workshop, etc.)  
  * Organization name/organization type (career, affinity, etc.)  
  * Location  
  * Date range

### **Create Event**

Large, visible button to encourage clicks.

Users must be able to:

* **P0:** Input title, description  
* **P0:** Select a host organization (required) — any user can post under any organization  
* **P0:** Select date/time  
* **P0:** Select campus location  
* **P0:** Add tags  
* **P0:** Upload flyer image  
* **P1:** Add external registration link

The Edit Event form shows the same fields as Create Event, in the same order.

Users can edit/delete their own events.

### **Notifications**

Dropdown panel showing:

* **P0:** Friend requests  
* **P0:** Upcoming RSVP’d event reminders

### **Account Settings**

Available upon clicking into profile picture; separate page (not a dropdown panel).

Users can change/add:

* **P0:** Demographic information  
* **P0:** Organization leadership status  
* **P1:** Interest tags  
* Followed organizations

---

## **5.5 Sidebar Components**

### **My Events**

Two views:

* **P0:** Events created \+ “Create Event” button  
  * Event creation requirements:  
    * Organization name  
    * Event details (see components in [5.3 Explore Page](#5.3-explore-page))  
* **P0:** Events saved/RSVP’d

### **Map View**

Interactive campus map displaying event pins.

Requirements:

* **P0:** Clickable event markers showing basic event details when hovered upon  
* **P0:** Forward/backward time navigation (**P1:** using sliding bar)  
* **P1:** RSVP’d friends profile icons visible upon hovering on event markers

### **My Friends**

Users must be able to:

* **P0:** Search users by name or NetID  
* **P0:** Send/accept friend requests  
* **P0:** View friend list  
* **P1:** Scroll through events friends have RSVP’d to (optional for MVP)

### **Clubs**

Hub to search for, follow, and create student organizations.

Requirements:

* Profile pages  
  * Logo \+ name  
  * Organization description  
  * Officer contacts  
  * Follow button to receive notifications for new events  
* “Create Organization” button  
  * Only visible to people who indicated being an organization leader  
  * Textboxes \+ image upload to edit profile  
  * Only organization creator can edit profile and transfer ownership  
* Organization search bar with category filters  
* Organization recommendation feed

---

# **6\. Success Metrics**

## **6.1 North Star Metric**

**Weekly meaningful event engagements per active user**, defining “meaningful event engagements” as:

* Click-through to event details  
* RSVP  
* Save  
* Calendar export

## **6.2 Supporting Metrics**

* % of users who engage with at least 1 event per week  
* Average RSVPs/saves per event  
* Time-to-first-engagement after signup  
* \# of friends added per user

---

# **7\. Risks & Mitigation**

## **7.1 Event Quality & Relevance**

**Risk:** Events automatically scraped from listserv emails may include irrelevant or poorly formatted information (e.g., incomplete details, spam-like promotional emails, or non-event content).

**Mitigation:**

* Implement event classification filters to detect whether an email contains a valid event.  
* Require minimum event metadata (date, location, title) before publishing.  
* Flag uncertain events for manual review or lower ranking in the feed.  
* Allow users to report events that are misleading or inaccurate.

---

## **7.2 Data Parsing Errors from Email Scraping**

**Risk:** Email formats vary significantly across campus organizations, which may cause errors when extracting event data such as time, location, or title.

**Mitigation:**

* Use structured parsing rules combined with NLP extraction to identify key fields.  
* Implement fallback behavior (e.g., display flyer image and raw description if structured parsing fails).  
* Provide an edit option for the listserv email sender to claim and correct scraped event details.  
* Maintain logs to track parsing errors and improve extraction rules over time.

---

## **7.3 Duplicate Events**

**Risk:** Events may appear multiple times if they appear in multiple listserv emails. Duplicate events degrade the user experience and fragment engagement metrics.

**Mitigation:**

* Implement duplicate detection using:  
  * Title similarity  
  * Date/time matching  
  * Location matching  
* Automatically merge duplicates where confidence is high.  
* Allow organizers to claim ownership of auto-imported events.

---

## **7.4 Algorithmic Ranking Bias**

**Risk:** The ranking algorithm may disproportionately favor:

* Large organizations with higher RSVP counts  
* Events posted earlier  
* Certain popular categories

This could reduce visibility for smaller or niche events.

**Mitigation:**

* Include time decay in ranking formula.  
* Add diversity constraints (limit number of events per organization in feed).  
* Include exploration mechanisms such as:  
  * “New events”  
  * “Undiscovered events”  
* Monitor engagement distribution across event categories.

---

## **7.5 Low User Adoption**

**Risk:** Students may continue using existing discovery channels (listservs, Instagram, group chats) rather than adopting a new platform.

**Mitigation:**

* Partner with student organizations to promote the platform and post events.  
* Highlight unique value through marketing campaign: personalized discovery, centralized event publication, and easy coordination with friends.  
* Launch with a beta group to generate early engagement and feedback.

---

## **7.6 Social Feature Adoption Risk**

**Risk:** Friend-based features may not be useful if the user’s friends are not on the platform.

**Mitigation:**

* Encourage friend connections during onboarding.  
* Surface “popular events on campus” alongside friend activity.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAGlCAYAAABHmqrEAABKmklEQVR4Xu3dh59TVd748d8/8biPzxZwdRel9yqgiFIEsaGgiF1sqz4qrmsB26NYUGyLoiwWFAUFBBFUGBiQjiC9SRGRqgIzlKk5P87JnEtybjIzSW5uzsl83q/X95U7N5lMEryZjzfJnf8nAAAAYLX/Z64AAACAXQg2AAAAyxFsAAAAliPYAAAALEewAQAAWI5gAwAAsBzBBgAAYDmCDQAAwHIEGwAAgOUINgAAAMsRbAAAAJYj2AAAACxHsAEAAFiOYAMAALAcwQYAAGA5gg0AAMByBBsAAIDlCDYAAADLEWwAAACWI9gAAAAsR7ABAABYjmADAACwHMEGAABgOYINAADAcgQbAACA5Qg2AAAAyxFsAAAAliPYAAAALEewAQAAWI5gAwAAsBzBBgAAYDmCDQAAwHIEGwAAgOUINgAAAMsRbAAAAJYj2AAAACxHsAEAAFiOYAMAALAcwQYAAGA5gg0AAMByBBsAAIDlCDbkrePHj4uXXnpJNG/eXPzlL39hQpiWLVuKl19+WZSXl5v/HACADBBsyDuRSMQXEkxuBgAQDIINeaVLly5eLMhwQ27ERnP//v3NswEAKSLYkDeaNm3KXh0LyX+Trl27mqsBACkg2JAXVq5cSaxZTP7bHD582FwNAKglgg15QQbB/fffb66GJa655hqCGgAyQLDBec8++ywx4AD5bzRhwgRzNQCgFgg2OK9evXoEmwPkv9Ff//pXczUAoBYINjhPhkC/fv3M1bDMGWecQVgDQJoINjhP7mFbsmSJuRqWkXvXCDYASA/BBiAUBBsApI9gg9PmnPNf3hycM9M8GxYh2AAgfQQbnBSpqPBC7YfWp4u5DaPLy67sbl4UliDYACB9BBuco0Pt+5ani6Kef40bfd78Tmeb34YcI9gAIH0EG5zxy6QPvSAzQy12dp/3F+9ysAfBBgDpI9jgBB1ghY1O8wVastHfs6RfF/PqkAMEGwCkj2CD1ea1PkNF1+Kmf/AFWW1Hh9vvSxeYV48QEWwAkD6CDdbSobWzy198EZbq6OviZdLcIdgAIH0EG6xSWVbmhdWBC+r7wivTKWx8mrruBV0amz8aWUawAUD6CDZYQ7/8KccMraBH/5yyw4fMm4EsIdgAIH0EG6ygA2pD+z/64ipbU1B17LaNw+83bw6ygGADgPQRbMgpHWrfNUn/QwWZjr4Nyy7vZt48BIhgA4D0EWzIiZL9e71QOtzDH1Fhz/p2f1S3paDJ6eZNRUAINgBIH8GG0OlQ25+FDxVkOgVVt00OgkWwAUD6CDaEZlHPdiqE5jeu/cFvczFyj5+OtmM7t5l3A2ki2AAgfQQbsu74rh1eAK1rF96HCjKdlS1PV7d5Xqv65l1CGgg2AEgfwYas0qG2o/OffUHkyuj78P2gvubdQwoINgBIH8GGrFh62Xle6JgB5OL8ftGpY8RVlpSYdxe1QLABQPoINgRubrM/qbBZ2ep0X/i4Pjrafh7/rnm3UQOCDQDSR7AhMDpm5jYM7kMFJ0Y9LMqXzBHFA9qKot5niYptG9T6ijVLRNnMT0RRv0bq6/IfFovST94UxVe2EMfu7y+KB3cWFeuWi5L3RvquM4jR93X9v/5hPgxIgmADgPQRbMhYeXGRFzC/XXiGL24ymRNvDlenxdd1Vj9LLouy0lPLJ+mIK+rT4GTYtYn7/kp9XhZmYdM/qPvMhxJqh2ADgPQRbEhb7MFvt52bnQ8VRH4/oE5jg63ko9e8ZXU7xr0UvUz/Fl6wFV/aWJ1W7v/Fd51Bj34M5jQ8zXts4EewAUD6CDak5WDhtypS5N/jNAMm0On9N3VafHVbdXps6NX+y8jzr2olii7+e9y6449c57tctmZ/t/peuCExgg0A0kewIS0yTPaeX88XLkGPfA9a5MjvvvW2jgzY+R0amA8XBMEGAJkg2JAWGWxmrDDyryRED/8BP4INANJHsCEtMko2OPRXC8Ia+bgs6Xuu+XBBEGwAkAmCDWnT79n6vmX2j7cmSk/41tU0pZ+OVqeR40d95wU9+rEobHeW+TChCsEGAOkj2JCRNXdf78WKGTHpTPn3C0TJf15Qy8VXNhcVm1erZRlsFT+uF0X9Gqqv5fLRu/pEl7euFSdeelAtl4x/LXo9y+d5wVb+3SxRvnCWqNiyRhRf0cz7/pLxr/p+fqrza/dTHzaoPHHcfHgQg2ADgPQRbMhYpLLCi5ZMDu9R8eO66PIl0Sgrvrq1Oj16e28hysvUsiaXy5fOOfW9OzZ7y8eH3Rw9/2T8yVN5aBBx8jbq7y9562m1nOkx2uY2jN7nVTdd4d0uJEewAUD6CDYEpuLEcS/cDvfwB05NUzppjDo9/viNceuP3tnnZBVG1LJSWamWI4d/E+JYcXR91To5xQOjhwDRkSaDLXK0yPv+o3f0ji5HTn1PKrO4WfSAuXJQewQbAKSPYEPg9B9+T+cYbcXXdRJFvc7yrZdzbOiAU8sPXOUtH390sO+yxQPb+daZU77oG9+66kb+FQcdaiX79ph3GzUg2AAgfQQbskbHzdq27n+a1HvJ9+VnzLuJWiLYACB9BBuyqmjtD17smBHkwqxqdTovfwaEYAOA9BFsCIWOnnmNTvNFka1TUHWbF13Y2rw7SAPBBgDpI9gQqoJG0Tfsb2r/J18g2TI6LguanG7efGSAYAOA9BFsCN3i3h2sfJn0SI9TsXZkzUrzZiNDBBvSNWfOHPHRRx85NV9++aV5N4CMEGzIiUhZmRdH+7rV98VT2DO/8WnqthS2qm/eVASEYEM6vv/+exVAy5YtE6tWrXJiZs6cqW7z1KlTzbsDpI1gQ04VbViT071tG9r/0fv5yC6CDenQe6w2b97s1Mg9bPJ2A0Eh2GCFBZ0bRt/g3/QPvqjKxsS+/Plr4bfmzUEWEGwBqYyIksu/EyW9Cu2aSxeYtzQQBBsQRbDBKjqi5J99MiMrqNE/Y81dg80fjywi2DKn46j0+qVCzP/Vqikbsty7fUEi2IAogg3WOfD19Ky8TLq10594+TOHCLbMeDGUIJasmYIDgUcbwQZEEWywlo6rBU0yf5lUX1dB4/82fwxCQrClr6TPfPtjLWbkba384ZB5N9JSU7AtWbLEt86GIdgQNIIN1tOx9ct59XwhVtPIv2cqv1ceSgS5RbAlV93jUlGwz6lY05PKXjZ5/wsKCszVSqJgu/fee1WoNWrUSJ2OGTNGLcvzhg4dKlq1auVdVq+Xp3JWr14t7r77brXu4Ycf9s774YcfRNu2bUWzZs2875XXu2jRItGtWzfx6quvijVr1ohrrrlGnTdhwgQ1jRs39sWaHIINQSPY4ITCNmem9DLpkZ6n9qrtnTbJvDrkAMGWnIyEZI+NEy+FJhh5mytm7THvTkLnnXde0vufKNhkXMnIGjFihLeHrW/fvnGXmT17thg3bpyYOHGiKCwsFMOGDRNDhgzxok1exgw2OYl+jpz169erU3nYDnmevA4Za+3atYv7Hj0EG4JGsMEpSy7upCJMHjfNjDQVajGf/ixav9r8duQQwVa9Bg0aqMdn7ty5cetV+Ly21RdEto8Kzd6138v266+/qvsv91rFShRso0ePFv3791d70sxgkwEVu1ct9rRFixbq+9555x319YYNG7wgk3F29dVXe5eVI4Pw0ksvVeumTJkirrrqKrWnTZ4nT+XXgwYN8sWaHIINQSPY4JzdE8Yl3Nv2U5e/eOsjlRXmtyHHCLaa6WiLJcMnMm2PL4hSmXcfGiW2fLxMtGrQTLQ5p4XvfHMWj57lW5fqpPPhg3POOUfd/6+++spblyjYsjEy2FauXOlbn+4QbAgawQZnzW3+Zy/Q9Oz490jzYrBEXQu2vXv3qqPzyz1AqYz5ONUUbKv+M09s//R7sWPiKvV1watTxabxi8Wxb39WgfbjhOXi8MztoneH7uKJGx9SIy/36HX3i8p5B9TygwPuEmvfX+Cd/9uX0T16816bJp697TG1/PGwMeKeK25VywenbxH/qFpONrHBJh8HeZ9SGf2nncIKtqCHYEPQCDY4b9MTD4i9X0w0V8MyZojko+HDh/vCI905dCj6Kcuagm3acx+pUxlnK8cWiEjhQe88uU6e7pu6QdzXf4i3Tq/XM/HJsXHrfpq0Wqz+T2Hcdd3Y+xpvue05LcWE4e/EXYc5scFWXFws7rnnnlqNvv8yeCWCDYgi2ACEIt+DTYeGfLN7umbNmqWuY8eOHd66VIKtfO4+seuz1eKFO57w1slTM9juuPRGtXxF1z6iXcNWavmCVl2865TBJq9L7rnT62KD7a0HX1Kn7Ru1jrstsZPOS6L6v5GdO3d66wg2IIpgg/NuWz9U3LtpmLkalsnnYNOxlokzzjjDF2uS+tDByM2+ILJ9Uv3Qgb7/JoINiCLY4DQZa3ru2viIeTYskq/BJu9T/fr1zdUpWbhwobqePXv8h8Hw9lQliCKbR97m0qE/mHcnoer+28g02OQnPKdPn65OP/zwQzFy5EjRpEkTddy3jh07iscee0xdbsCAAepUHrZDnj958uS4T4ymOgQbgkawwVl3bHjYi7Whm59Wpz8eP/VSCuxS3S9lV0UikUDuk7wO/Z4tU/lrW5wNttqS93/fvn3maiWIYJOnDzzwgLe8YsUKFWyxl4sNNn05vS6dIdgQNIINTtKhppdf2jHaW2ZPm53yMdiCeCm0Nlzby6b2rt230rwbaQki2Hr27KkOzitjrFOnTuqAtzLYBg4cqI7Npi8n1+tgk9/Tpk0b3/XVdgg2BI1gg3NiY01/rYNt14lf1Nf3bHzMOx92yNdgu+2228zVWSEjqOy+6KE7bB75vrVU9q7VJIhgM9fJMfew1eZ7UhmCDUEj2OCc2FjTX+tgk/aW7Be3r38o5hKwQb4G2/bt283V2VFW6e1pi8zc5wulXE/kq+jfPFW372i5eevTlmmw5WoINgSNYIPzzGCDnfI12MKm39Nm40QOlpg3N2MEGxBFsMF5BJsbCDakw9VgmzZtGsGGQBFscB7B5gaCDenYtm2bCh95mI2pU6c6MRMnTlS3edGiRebdAdJGsMF5Q9Y/JNYUbTBXwzIEG9K1YcMGb0+bKyP/LiwQJIINQCgINgBIH8EGIBQEGwCkj2ADEAqCDQDSR7ABCAXBBgDpI9jgnHvuuUedXnLJJWLNmjXilltuEbfeeqsoKSkRrVq1Eg899JB3GdiDYAOA9BFscM4dd9whKisrxfjx41WwyWXtmWeeibkkbEKwAUD6CDY4Se5Jk8xg0/T5sAfBFpyyR9b4/sqAa1M6ZLl5twBUg2CDk2KDbeTIkeLll18WxcXFar08cGX37t2N70CuEWyZKx285FT09D4ZPVctcnJK+s737kfZCI6hCNQGwQYgFARbZnTgmH903fXx7heAahFsAEJBsKWv5MqFeRlreog2oGYEG4BQEGzJrV692lwVR8ZMxYubfaGTN1N4kGADakCwAQgFwZZc/fr1k15Xvr4Uao76IMI1i827D6AKwQbn3bZ+qJj96wJzNSxDsFVPXlei61NvzL/je1/g5N0URqMNQGIEG5wng+2lHaPN1bAMwVazRNEmIyYydY8/cCyaolk7fevSGYINSI5gg/MINjcQbLVjPk4q2KbVHGwzX/zUW/5k+Dve8rh/vX5q+eHocuHr09XptOfGq9OKeQfEVy9+In6csEK0b9Q67nrfe+QN3/e3atBMzHvtC3FD74Fiz5T16no2jV8iPntqnHfZDx59U1SevF65XDJnj9g9eW3c9SYagg1IjmCD8wg2N5ghkg+quz/yT6XpPWbpTMeOHaPXU4tgWzV2rjr9/t0CFVNy+cGBd3nLgy7q7y3L0+t6XOUt6+s4MG2TOu3UpJ23Lvb8oQPv9q1/7Pr7va9HP/Cit/z7jG1q+c7LblKnt/QZJH7+fI33/cmGYAOSI9jgPILNDXUl2I4dO+ZFl/w7t6nYuXOn+r7Zs2d762oTbOc2ba/2Zs1/40svpuQeLr382r3PxgXb3Zff7C2b19WpSVtvefNHS73lp2/+l7dcU7DtnbpBLd9z5W3q9Lcvt4oX73zC97PMIdiA5Ag2OI9gc0NdCTYda6nat2+f+r4zzzwzbr2MmMpPf/bFTeyseGeO2P7J995erNg4evjae7zlR6/7X295xO3D4l7u1PPVC5+Ikjm/qOWfJq0Wj1R9z/4vNol/XhO9LvkS55v3v6CWV4+br65n1di56mt9nd+M/EwUf/1TdPnlz8T0ER/5fpY5BBuQHMEG5xFsbqgLwVbd4TlqIr9PPkYmdbiLKxb64sb2aXNOC9H67Oa+9UmHT4kC1SLY4DyCzQ35Hmy33npr2vdPft8PP/xgrlbKnttQZ47DVrH8N/PuA6hCsMF5BJsb8j3Y5HLjxo1jzg2OOhbb4FPvJ8u3qfxoF3vXgBoQbHDe41tfECcqS8zVsEw+B9uJEyeyft/UHqg3tvpix/Upf+CH6H2bvNu8ywBiEGwAQpHPwfbZZ59l/b5F9p1QYVNy8Xxf9Lg6pYOWqPtU/vaP5t0FYCDY4LRJW4Xo/Hl0yivNc2GTfA620aNHh3LfIr8cj0ZbHg2A2iHY4KxuU6KhNm27ENd9G13ec9S8FGxBsAFA+gg2OEnH2nx5uKiqeX1NdN2vJ8xLwwYEGwCkj2CDc/RLoLGxpufNqmi7epb5Xcg1gg258tJVQjzXj0k0cAfBBqck2rNmzvjN7GmzEcGGXCg7EQ2T1d8K8eMKJnbk47JjtfmIwVYEG5xRm1jz9rSt5T1ttiHYkAvjH4mGiRkrzKnHBm4g2OCE6l4GTTb6PW39ZpjXhlwg2JALBFvyIdjcQrDBet2nph5ret5aF/3eA8fNa0XYCDbkAsGWfAg2txBssFo6e9YSjbyOy9jTllMEG3KBYEs+BJtbCDZYK6hYk/N21Z62i74wfwrCQrAhFwi25EOwuYVgg5VS+YBBbUe/p63/TPOnIQwEG3KBYEs+BJtbCDZYJ8g9a4lGXjfHacs+GTCtWrXyvjaDbcuWLc5HDsFmv1wE271DnvSts3EINrcQbLBKtmNNj/wZvaeZPx1BWrt2rYqYhg0bqq9jg23nzp1q+ayzzor9FucQbHaQj32yxz/oYCuctlPMmLBaLXfr0lc0PqeVWn756Y/E8jkHRcHUH1Ww9e05UGxeViFatzhXvDvqSzH941Vi89JyseXkujYtOnvX16Rh65PrKsWMT1ar69q6PCLeHvmFaNWsk7psk3Nai5Vzf1fX/f6/v/XdnkyGYHMLwQZrhBVrcvRx2nhPW3YtXLhQ/SLduHGjF2yrV69Wpw0aNDAv7hyCzR7Joi3IYLvv9qfE5X2uVyO/vviiq8Wybw/EXUaeJ4NNh5w8lcEml98dNSPu++Vc0fdGddqsUVvRo9vlom+PgeLZx97xvv/Jh/8tBl/9D9/3BTEEm1sINlhBxlOPaf6wyvbIn9vvS/PWIGj6l6mepUuXmhdxEsFmlzPOOMP37xBksMlp3fxc0bRRGzFz4lqx9rtj4o3nJ6n1Tz78phdZ+iVR+fXqwiIv2PS62PDq02OA93233/gvtSyDTX7dpWNP8fS/3lLLzZu0Fy2bdfTdnkyGYHMLwYacC3PPWqKRP/sqPoiQVYWFhV6sLV682DzbWQSbfcw9bUEHW9Ajg81cJ6df72vFbdc/5MVcNoZgcwvBhpySsSQ/EWpGVNijoxHZdfDgQXOV01wLtuPHj/v2dubzSLYHWy6HYHMLwYacydXLoMmG97QhVToKXAg2HTH169cXb7/9tnl23rj22mvV/fznP/+pvibYkg/B5haCDTmR65dBk428TVfWsZdHNy+OPmnn03wY/V2dda4Em4617du3m2flleLiYnU/hw8f7q0j2JIPweaWvAi2c845Rx0eoC7N4cOHzYfBGba8DJps6tLLo2/eHH3CXjLZ/2Tu6mz47lS4ZZsLwSY/nVuvXj1zdd65/vrr1b9BaWlp3PpUgy2b7xmradq3Pt+3bt60Hb511Y38cIK5LtkQbG5xOti2bdvmBYw+ZEBdGH2f//73v5sPifVsjzU9dSXa5JP1qEH+J3LXZ8vScH4Rye1RsjnYbL1dQerVq5e6n0899ZR5VsrBdmnv69SpPD7axsWlYtbEDWL2lC1ixZzf1Kc71y88Lj4cPUdcdenNYsPiEvHgXc+Kbp37iE1LytT3yE+FRr+/jVh38rIbFpWIFk07qHVX9r1J3HHjI971T35/mVqWkSivSwbb8IdeV8dik+fL47jJ47qdf+7F6nKD+t8pBl4+xPueSeMWiVVzD1VFZkStf/T+l333KdkQbG5xNth0tJgxU5dGPwY7duwwHx7rbDkUDaDuU/1xZOt0nZz/0SafrF+7wf9Eng8Txi8iuR1KtgZby5YtrbxdYUo12K658nZ1+ugDr/jOW1p1zDUZUj8UHlHLHdp0U8Eml/ufjDh92btufsxb1pGlo0rOeScjTB4YVy7rvXoy2HpecGXcOrmHTQabPLiuDLlFs/aow4mc2/4idf5Xn6xVpzIu5ekLT7zn/YyahmBzi5PB9re//a3Ox5qeM888Uz0WNlu6z74PGNR28n1PG8GWGbkNSiNHjvSWbaKfJ+qyVINNh5IOtrYtu6i9XXJZHthWnx+7XNtgu+ziwd7LnrHB9vqIT0XHNheo82ZP3iKaNmrrXbc81XvYLjzvUtGnx0C1HBts8sC6+vIyIPXPrWkINrc4GWwyUOQnncx4qasjH4877rjDfJis4crLoMkmn6ONYMuM3P6kDh06eMs20c8RdVmqwbZ41h7fOpfm7Ze/8K1LNgSbW5wLto4dO7J3LcHYuJdt8+/R0Jm01R9Brk2+vjxKsKWvRYsWatuT5OmAAQOMS+SevF2TJk0yV9cpqQZbXRqCzS3OBRuxlnjk4/LWW2+ZD1fg5M8pLy83V/us+dXdl0GTjat72op6/lWI8jJztUKwpU9ud/KYX3rZNgcOHFC3KxKJmGfVKQRb8iHY3EKw5cnoDyBk28CBA9XPeeGFF8yzPCv2R8Pmi+3+6HF9XNzTdvzJ21S0nRg51DyLYEvTueeeq7Y7SZ6+9NJLxiVyT94u+R7Xuo5gSz4Em1sItjyZsIJNuvPOO5PuadOx9mkevAyabM5zMNpOjHpYRVuk9ETceoItdfoQEpLe/mwjj7tm4+3KBYIt+RBsbiHYajGSfnnB1gkz2CS9py3W0TL7P2DwxZr9okHTVmL29hO+81KZMF4ebdWqlTpt27atWl64cKFxidQcH3Fv9OXRGNkOtq4de3nL+pN2qc6UD6LHqkp1svGLSG9vb7zxhrds20uOzZo1U7fLPIBsXTXjVYIt2Yy5U4i3hpiPGGxFsJ0c+VcDRo0aJc444wyxefNm8fjjj4ubb75Z/TwZJtLSpUvVZeUfr5Yvf8hlafDgwWLs2LHedf3888/qOuT/4Z44cUL9zT79soT+cynt27cXnTp1EkeOHPHdlnQnNtj0cljz4osvqp8rA+aqmf64SXVkUL0zc4UYP3+TuP3REeLDuRvENXc8JJq2PVed36xdZzF97cG4y+vTrr0vV8vysi06nicmr9gtGrfuoM67e/jL3vf8c+RY389NdeT9fWKZuusqhDKZWIMGDVKnMtJiY+DTTz/1liXzOlKZ48/do64jk2CTAaYjTB5S4Ol/jfaW1y08ppblUdc/G7dYrJjzq7rsq89+Irp07KmOJ3VJz2vFue0vVJeThzR46B/Pe9/z3LCxolvnvurQBZkGmzxOobm91JWRB9cuK0v8/sW6RP63wCQeuINgOznr1q0TJSUlokGDBuLZZ59V6zZs2CBmzpypliUdbE8//bT3ffLTV/I0Ntj0PProo+LHH39U0dajRw/1pKmv69ChQ979Mb8v3dHxJHXu3NkXVdmcqVOnRn/uyYC55Et/2KQ6OsAG3/uYWtbzyeJtonB3RLTpcqF3mdjLy9MXPpihTsd9uzruexNdPtOR9/elVdF/RzOIUpmjt12k/3PwyFiTc+zYMW/d9OnTYy6R2c8s/fwddR3yCTvdYJMH79TLLz89XjRr3E4s+Wa/Ov6UPiaU3sP28ZjCuLi7ou8Ncdd14Xn9RMumHdXy+LcK4s7LNNh+//133/ZSF6eu73Gb9Iw/VuryvHa9EBW0vFMItpMjfzHecMMNvmCT5LKUKNgkefyl2GCTx0MbNmyYOrivvL7bbrtNBZt02WWXqdPnn39eXVbu2TNvS7qj4yks8iVi+fO+/PJLb92wJdGIeX2NP25Smdhg69Irusesc89L1WmjVu3F11uK1V42ffmzm7UW836uVN/X8txu3nXo62nV+YK4SOt19Q2+n5nqdAnhfWz6JVH5nsHKykrv63RFjvwejbWvPvbWqSfuNIPtgq6XiF7d+6tlGWGfjVuigq11i85q3ZoFxUmDTR4lft607eKNFz47GX5HxZr5xeKtkdHjR+lgm/ifheL54eMyDra64vvvv/eeD8yXafX6u+++O249AHcQbBmMfFKUp/JlU/M8c+SeEhlxM2bM8J0XxIQZbF27dlU/y/ylIO07Fg2Z0Wv9kZMv0yWE968FrfjW7irWTpZf3PpMgs32qWvBpv3222/qOeGrr76KW3/8+HG1Xv5PKQD3EGx5MmEFm3xDs/w55i+DWAdPRINm7AZ/7Lg+YXzYIGjFgzpE96xN+Y95FsGWp+T/HMrnhUSSrQdgN4ItT0Y+LuPGjTMfrsDVNgp1tMnjlpnR4+q4GGuS2rOWBMGWv/Rzg0k/hwJwi3PBpl+OM4Olrk9tQypMOtpeXe2PH9cmjPes5QLBlr/kp9Xlc0MiydYDsJdzwSYRbPEjH482bdqYD5MVDhyPhs676/0R5Mq4umetNgi2/CafH7Zv326uVuufeeYZczUAizkZbGeffTbRVjVhvXctE7+VRINH7qUyY8j2yedYkwi2/CafIxo1amSuVuvl+9wAuMPJYJPkITPqerTpWIs9rput9Muj8s86mVFk67j4adBUEWz5TT9XmJKtB2AvZ4NN2rt3rxctf/3rX31Bk49Tv3597z5nelyuXHAh2ubuzv89a5qMmleu9ceO67NpEcEm6ecNU7L1AOzldLBp8k896YipKxN7BHzX2P7yaF2JNWnMXdGwmfqSP3pcnfWF0ftEsCUPs2TrAdgrL4INbrH5kB91Kda0kQNOBU4+DZKHWbL1AOxFsCFnbIo2/TLokHnmrQTclSzMkq0HYC+CDTllQ7TNq0PvWcsl+eGYfv3Y9RWmZGGWbD0AexFsyDkdS2ZIhTXyZz+w0LxVCJr+YBDCkyzMkq0HYC+CDVbI1QcR5M+99lvz1iAbCLbwJQuzZOsB2ItggzVkPIV1yI+6dOgOWxBs4UsWZsnWI7uKSqPPOR9uMs8BakawwSphvDyqY42XQcNFsIUvWZglW4/s0QfifmQx/7OI9BBssE62o01e9z0LzJ+KbCPYwpcszJKtR3bIt3vI552Cn+Ofh4g2pIJgg5XkE1nQnx7l06C5RbCFL1mYJVuP4OnnnNhY08PzEVJBsMFaQe5pG74sel23zTV/CsJCsIUvWZglW49g1eY5TO99A2pCsMFqtXnCq2n0nrWhC81rR5gItvAlC7Nk6xEcHWLm81GiIdpQGwQbrNf3y9o/8ZkjI01+7/Fy81oRNoItfMnCLNl6BCOd/9HU0SY/SQokQrDBCek8AT66JPo9gzjOmhUItvAlC7Nk65G5dJ6r9OjvBRIh2OCMVJ4I9aE77plvXgtyhWALX7IwS7YemUnlOSrZ8PIokiHY4JQBX9f8hKj3rB3lZVCrEGzhSxZmydYjfUHEmh4dbcVl5k9BXUawwTnVPTHq96zdy3HWrEOwhS9ZmCVbj/Sk8gGD2o4+0C7RBo1gg5MumuZ/gvznoui68krz0rABwRa+ZGGWbD1SV93/QGY6I76PXvcxy18tKCoqElOmTHFmdu7cad4FJxBscFb/WdEns1E/CHHZjOgynwa1F8EWvmRhlmw9ak/+j2E2Y03PsKXRn3GiwrwFdvjoo4+cnC+//NK8K9Yj2OA0/YQp59XV5rmwCcEWvmRhlmw9ai+MWNNj8yE/ZPxs2LBBbN682amRt9s1BBuAUBBs4UsWZsnWo2aVkWg83VrgD6tszrMr7Iw2GT5mDLkwBBsAJEGwhS9ZmCVbj5qFuWfNnP+rijabXh4l2MJDsAEIBcEWvmRhlmw9ktN71uR7Z82QCnOerPq7yANmmbcwNwi28BBsAEJBsIUvWZjdeOONCdcjsbKqDxjcHPLLoMlGfxDBhkN+EGzhIdgAhIJgC1+yYCsvL0+4Honl8mXQZKMP+ZHraCPYwkOwAQgFwRa+ZMEmNWzYUP2b1EU6WD/44APzLB8ZRYO/9QdTsvlqwyFR+HOluGTQberrBk1beed9umSHmL72oJi1uchbN33tr97ye3PW+q6vutHRls2XR/fv368eK3maCMEWHoINQCgItvBVF2ySPG/EiBHm6jrh/PPPV/f/888/N89S9HHWBn7tD6WaRkZazysHe18//vp4MXdXufh08XYVbLGXnb39hLf82fJdvuuqafTLozfNNu9BcKZNm6Yeq19++cU8i2ALEcEGIBQEW/hqCrb+/fur8wcPHmyeVSf06tUr4eOTyUFxZayNeG+6tyxjbd6uCrX8+ueFccEm11084Gbv63SCTY7+IEI2D/mht98DBw7ErU8UbOvWrRMbN270rbdpCLaQbNu2TXz88ccMU6fHNQRb+GoKNk1f7qKLLhLHjx83z85rR44cUfd9zJgx3joZP2EfZy3Tmbc7ersrIjF3LmDyzzrJx2rfvn3eOjPYJk+erEJYB1u3bt3Eq6++qtbLr1977TV1Kp/DJkyYELdOj3ypeunSpeL9999XX69atSrh5eTeYXn67rvvqtNGjRqJGTNmqOXly5erU3k9ci9q7PfJIdhC8MYbb4ihQ4cyDHNyFi5caG4i1iLYwlfbYJOWLFniXb6ujpbOnjUbRt7uubuj98G8b0GPZgabnKuvvtpblsG2YMECL6jkabNmzUTnzp3V8r///W91umbNGnW6adMmdXr//feLL774Qi23bNnSuz59HXJksM2ePVstjxo1yjtPnupgW7lypTp96623vO+TQ7CFQP6SAiDE7t27ndoeCLbwmb9c4bd48WL1GMXuNZLhc/4UfxDZPLN+it7ubLrssst8/z2lE2wyonSwrV27Nu68a665Rp3ed9996vTCCy9Ue9rmzJkTdzk5Mtj0188880zCYNMhuH79eu/75BBsIXDpFxSQbS5tDwRb+Ai26k2dOlU9PuYnIDceCi7aCndHfOuCnq+rYu2TrXF3I1A33XSTeqwef/zxuPWJgu3ll1/2lp966il1+uCDD6rTQYMGicLCQjF8+HDvMtdee623Z01/PXHiRLUsQyx2/aOPPup9LS8jXwKVL69+8skn6mc8+eSTKs5Wr16tLiNfjr3zzju979FDsIXApV9QQLa5tD0QbOEj2JKTv+jlY3P22WebZynrf49G0Gc/+gMplfl6S7FvXZAzsyrWuk4270Fwjh07ph6rF1980TwrYbC5MARbCFz6BQVkm0vbA8EWPoItseLiYvW4yLcV1ETGUPep/lCq7chg08dX63DBxd5hPPoMvEU0bNHOd/lU5pIZ0dv39S7zVgdHvpwpH6uKisR/wJRgCw/BBjjMpe2BYAsfwZbciRMnzFUJ/Vyc2cujMtgmLt2pltt0vUhcMmiIWu494CbRsGX6wabfszbpR/MWB2/FihXmKg/BFh6CDXCYS9sDwRY+gi04mUSbnIlLotH27bbj6iC65vmpzGVfZf8DBrVFsIWHYAMc5tL2QLCFj2ALloykbhm8PBrEXDUrejumbDdvXW4QbOEh2ACHubQ9EGzhI9iCtbPq5dFuGexpy2Tke9Xkz5+VxfespYpgCw/BBjjMpe2BYAsfwZYdmb48ms50/8Kel0FjEWzhIdgAh7m0PRBs4SPYsifMaOtf9TJoNo+zli6CLTwEG+Awl7YHgi18BFt2yYiSYwZWkHN1VazZSv6dThk/rs2GDRvMu2I9gg1wmEvbA8EWPoIt+7IZbf1mRK+7MmL+VLtUVlaKoqIiZ6asrMy8C04g2ACHubQ9EGzhI9jCkY2XRy+eHr3ez7aZPw11FcEGOMyl7YFgCx/BFp4g97Tp6wJiEWyAw1zaHgi28BFs4Qoi2vRx1ix/FRQ5QLABDnNpeyDYwkewhe+CqelHG3vWUB2CzQJ6I5Wz4oB5Lmprzjn/5Y2I1I3/P3VpeyDYwkew5UY6e9qINdSEYMuxu+ZFN9K7C6NvWpXLFXWjNQKlQ21Nm/85FW11gEvbA8EWPoItd1KJtv4ziTXUjGDLoUQbtP7TI2PXm5dGIsuu7K7ibGHTP4iinn/1ZkfnP0cD7r6bzG/JKy5tDwRb+Ai23KrNy6PsWUNtEWw5ojfSebv9G7A+qvW7RFu1tjz/uIqy7ef+JS7W9KxtG93bNq9l/v7Ccml7INjCR7DlXqL/MTdjzfbjrMEOBFsODP42+Qas54qqXeS8PJrYvJb1VIz9duEZvlCLnYPdz1CXW3JJF/Mq8oJL2wPBFj6CzQ6Joq131XHWgNoi2EKWaMNNNt9UvTw6YYt5LXWbfo+aGWfVjf6e8uIi8+qc5tL2QLCFj2CzR6+qQIsdIBUEW4j0RproZdBkc13V3rgx68xrq3siFRVpxZoZbbs/fd+8ame5tD0QbOEj2Owi3+Yin8/lB8yAVBFsIZEbaZda7lkzZ3bVnra363C0zW0e/RDBylan+0IslTnYvb66nkUXtTF/hJNc2h4ItvARbED+INhCkMrLoMlm9s/R6/h4s3nt+e+785qqyNpzfj1fgKU7em+b61zaHgi28BFsQP4g2LIsiFjTo18e/XCT+VPy19zmf0r7JdDqRn5YIR+izaXtgWALH8EG5A+CLYvUy6CT/eGVydSZ47RFIhm9X622s7DJH9TPOLp1o3kLnODS9kCwhY9gA/IHwZYlQe5ZM2dO1cuj7+RptFUcP6Yial6j03yBlY3RYbjl2UfMm2I9V7YHiWALH8EG5A+CLWDHy7Mba3p0tMkPMuSTOQ1PU/G0rdOffGGVzTnSIxpuBY3+YN4kq9m+PcQi2MJHsAH5g2ALWDZeBk02+jht+RJtek/XoYuqPxhuNse197XZvj3EItjCR7AB+YNgC1CYsaZHR5vrx2kL4/1qtR19W+Rx32xn8/ZgItjCR7AB+YNgC0BR6ak9XWZQhTXy53edbN4y+2198QmrYk3Pqtanq9u0d9ok8yZbxcbtIRmCLXwEG5A/CLYAhPGetZpGv6dNjiuO/rhZRdGCJn/wBZMN8+uF0YPsLu7dwbzp1rBxe0iGYAsfwQbkD4ItAyeqPmDwxDJ/QOVqXIk2G/eqJRub39dm0/ZQE4ItfAQbkD8ItjR5L4OG/J612oztL4+6FGt6bI02W7aH2iDYwkewAfmDYEuTDS+DJhvvkB8WRpuLsaZH3/byoiPm3coZW7aH2iDYwkewAfmDYEuRPs7aiO/9oWTb6A9C2GBxz3YqdsI6GG62Zvd5f1H3Y83d15t3MSdyvT2kgmALH8EG5A+CLQU61mx8GTTZ2BBtes/UmrZ/9AWQi3O4hz1/hzSX20OqCLbwEWxA/iDYasnm96xVN/o4bbl6T9uiHm1V2BzsXt8XPi6P3tOW62jL1faQDoItfARbzSLbikX5G1vydirn7DPvMhxFsNWCjrXnHHgZNNmE/enR8iOHnX6/Wm1H38fKkhLzIQhFLraHdBFs4SPYEiu7f5Uo6VVYJ0dURsyHA44g2GqgD93xzAp/BAU519/7mLjxf4eLxq07xq1/4cMZcV8/9OI76vTKm+/1XUdNE1q0RSLWxNrRW7r71gU9+r4e3brJfCSyLuztIRMEW/gINj8dLpHP5RPjr3VmIrP2nYo2ms1JBFs1rv0mGjjpHGetYGeZaNC0lVruceUgcetDz4jC3ZGTy9eJq29/QK1v3r6reGv6ErXc4YKLxXtz1p487S0+XbJD/N+7U0STNp28YJPX1fOq671gS3d0tGXrf7Lmtoi+VJitvwdavmSOOPbAVSefcCrV10fvu0IFolyOFB0++b/OpWpZVFaKyN5dKtikkn8/KYp6n+W7vqDmQPfoQXbDfok0zO0hUwRb+Ai2eDJWSvsvFGbM1LWRj0P5iI3mwwPLEWxJFFe9DJpOrMmJDbaGLdqKzj37iafenqTW6fUfLdjsXV4GW/S0t2jWrrN3OR1sdzz2gjqVwSbDz/x5qUy29rTpYNnV9S++oAlqZLDJU6nkPy94P/vozd285aKeZ4pj/+inLieDTV4u8tt+33VlY+T9L2j8395tybawtocgEGzhI9hOUbE2YLEw46UuTulty6N72o7b//eScQrBlkBxWTRons/gPWtyL5oMLhlXb079Tkxe+YuYs6NU/N/YKWLGht/VZZIF279eHqeWr7/vMS/YzmneRoyaVKCCTQad+fNSnaA/iDC3+Z9VrMhPUJoRE+TEBltRnwZqOXL4N3VaNnuyKJszJbruaJEoK/hCBVuk5IQo7t9SHL2zj+/6sjFh7mkLY3sICsEWPh7zqMiOo9FASRAvdXW8l0fhDILN8MaaaMzYfJy1e5561bcunQlqT5st71ezaeY3Pi2UaMv29hAk4iF8R48e5TEX0b1rZbctF2a01PUh2NxCsBlkwPSeLnxxk68j7+/HW8xHofZW3XQlsZZk5OOy9cUnzIcsUNneHoJEsOWGfMynTp1qrs4rNb30y961xKM+fPHLcfPhgqUINoMMmIu+EL6wydeR93fWT+ajUHsbHrmHYEsy6v18H7xtPmSByvb2ECSCLXfk4/7hhx+aq/NKsv++ykdvJdiSTOmty0XpPSvNhwyWItgMy/dHI+aab4QvbvJteEk0ezO3YTjvY8v29hCkZL9QkX3NmzdXj/0tt9xinpVXEv03Vjb0h5SDrWT2HlE0a6dvfbrz+4wf1enyMbN95wU5FfP2+9ZVN2UPVD02cALBlsD7G6MhI/+Iuhk52Z6zm7X2rcvGnD8lmFjTwoq28tmTxdEbuqoPFZjnpTvHH73ety6T4UMHiSX6ZYrwXHvttd5Lh5FIxDw7b5gvj6YabK0aNPOti53X733Ot666Kf76J3U677VpvvMynUS3NdG6ZEOwuYVgq4YMmitmCl/spDu3PPSM9wnPy268SzTv0FUtN2/fRdw9fKT4auMh9cnSx177QLw4fqY4u3kb8fSYz8SYGcsCDbmg9qyZCpr+jwqV1W3+xxcx6Yw8ptqJVx5Wx1wrnTxWFPX5u6jctU0UXXKOiBw6KMoXfCWOPXi1+tlFvf+mPkEqjwhZ1OtMUbkn+jrvsYcHqe8v++I9cfQf/aLnn7zu0kljhKgojy5PGef72emMPPacvP/zOzY49aBkWZjbQ6YINjt06tTJi5p8HyndYOvbqYe4vGsfb92CN75Uy+0btfJdVp7u+my1qJx3QJzXopO4re9g32V0sF3Qqou3Pjauygr2xt2OLR8vE58+8a73dWXhAREpPHjyeuR7dn4VW0+er7+/c7P23uUu63Jx3PVUNwSbWwi2aryzLho218u92AnCJ5WZt6vCt04e6iP26wv6DYg7Tpsc/XXsukwmW7Gmrbn3RhUtP3XJ/FhsFetXqFOtfP4MUbltvVqng02fX/r5O97lZLAVX9U6uhzz/Zq+/pLxr6nTE28/4/vZqc6Wjn9S97ugyenmj8uqMLeHTBFsCEOPHj3Uf2djx45VXwcVbM8NeVwtP3Xzw77LytNDX21TL0ledX4/cW7Tdr7L6GC767Kb1Gmbc1rEBdsXz40Xuz9fo0Z/nz5fry+bu08Uzdqh1s1+ZXLc9z9z6yPq9Iqq21ybIdjcQrDVoCISDZzB3wpf/KQ6DVu2iwsvHWxyXaNW7b3lGet/Ex26X6wOuDtl5R7R8cI+gQSbvB8XTDHvYXYE8RKpDrbIwb2i8teTT1SXNEwabOq0NPr3PBMF29F7+onKndGPw+rr18Gm/1JCuqPva7n8SwshC3t7yATBhmzr1auX77+xVINtwvB31On0ER+JGS9MiFs3/Mahas+WeVl5WjJnj9oDZl7f4ZnbRfnJ0Nr9+Vr19fFvd4snbnwo7vv1TB/xsXjnoVfUcuwet0+ffFd8POxttVxasEedyj16697/Tt2e+W98KV75xzNqfWzE1TQEm1sItlqQf8ZJxs4lM4QvglyZbO9ZM0UqKwOJNtvHe79ajt4TlIvtIV0EG7Kpbdu26r8v8/155a9sTinYMp1EwaQ/dBDGJIrGZFN2xwpReueKuMcL9iLYauntqpdHB34tfDFk+4Qda7HyNdqO9Aj3wwXJ5Gp7SAfBhmzp0KGD+m9r3Lhx5lkiUlQWarC5NPJxqZh3wHzIYCmCLUU6fswosnXkbe3xhXkvwrW4V3sVNoua/sEXPi7O7vPqqfuzYmBv866GLtfbQyoINuSKDJPyoauFGSx1fXg51C0EW4r0e9qudeA4beo9a5Yc4HzH269E35Tf0O29bd+3PF3dj4MFs8y7mBO53h5SQbAhV2SYsJctfspuqfoD8HAGwZYmGUM2/wmrXL4Mmkz50WIVO3MbnuYLIRemoOol0PUP3WHetZyxZXuoDYINuaTipOCAMMOlro58PMoeX2s+TLAYwZYBW18elbepZ45fBq2Ofu/X7xed4YsiW8eG96slYtP2UBOCDbkmI6XyzfA+AGDryMeh9KZl5sMDyxFsGZCfRZJxFMRx2oIaeXu6hXTojkwUNPpvFUDyzftmHNk0tny4IBmbtoeaEGzItdIHVkVfHr1kgTAjpi5M5Tvbo/f/ioXmQwMHEGwBsGFP20ebq96z5kCsaeVFR6x+iXRThz+q27ft1efMm24NG7eHZAg22EK/p03tabpqkSgfti5vp+z2FXH3N7LjqPlwwBEEWwD0cdpyGW2uxZp2eNUybw+WGUy5nAWNT1O3SUalzWzcHpIh2GCVYxVxIZPvEzlSZj4CcAzBFiAZTbk4Tpv8ub2mmbfGLeoTpJZEmw7I3RPfN2+mdWzeHkwEGwCkj2ALWJh72j7cZP8HDFLhhdJ59XwRFdaocAz574FmwvbtIRbBBgDpI9gCpo/Tlu1o+2Rr1cuglhxnLSiF7c5S0bSsxX/7Yiqbs/+C+urnfnd+M/MmWc327SEWwQYA6SPYsqRLFqNt8rboda//zfyp+SPMl0j1nr1DyxaaN8N6rmwPEsEGAOkj2LIoG3vaPq3as7aryPxp+SeMDyPon+Eql7YHgg0A0kewZZE+TltQ0abfs5ZvL4NWJ5vR5nqsSS5tDwQbAKSPYAtB18mZR5s+ztraX81rz3+73n9LhdW6tn/0RVc6c+iiM9T1zWtV3/xRznFpeyDYACB9BFtIMtnTpt+ztuWQea11x3ddm0Yjq1FmB9nd1unP6nrW3nez+SOc5NL2QLABQPoIthDpaJvzsz/Kks35U6Lf81MdeM9abWTyEqn3Emik0rxaZ7m0PRBsAJA+gi1kqbw8qt+ztvWweS11mw6vVP4OaT68Xy0Rl7YHgg0A0kew5UCXWkTbJ1uil1lTB9+zVhup7GnL11iTXNoeCDYASB/BliP6OG3f7PLH2oVfRM/L5+OsBeHQiiUqxBY3+4Mv0uQsaPKH6PkXdzK/NW+4tD0QbACQPoIthxIdXHdiHTrOWhC2vvhkwr1ta9r8Ua07WDDL/Ja84tL2QLABQPoIthzT72mb9ZMQz62ILm9gz1pKSvbvi4u2uQ1PU8vlRUfMi+Ydl7YHgg0A0kewWeCB7059gvTgCfNc1NbquwerUJvb4s/mWXnLpe2BYAOA9BFsgMNc2h4INgBIH8EGOMyl7YFgA4D0EWyAw1zaHgg2AEgfwQY4zKXtgWADgPQRbIDDXNoeCDYASB/BBjjMpe2BYEONSipF5EiZiBy2f8SJCvPWA1lFsAEOc2l7INiQiAy0kl6FTk/Z/avMuwUEjmADHObS9kCwwae00oseMf9XJ6fsru+j0fboGvPeAYEi2ACHubQ9EGwwqdC5d6UvgpybuQfVfSn/vw3mXQQCQ7ABDnNpeyDYEMv1PWvmRGbuU/cncqjUvKtAIAg2wGEubQ862Ii2ukH+Ozdq1MhcrVSuPZRXsabHi1AgCwg2wGEubQ+xwUa01Q3J/q3zbe9a7BBsyBaCDXCYS9uDDrbt27er0/r165sXQR5KFG0EG5A6gg1wmEvbg/keNv2LXAYc8pv8dz777LO9r7MdbKMfeMm3Lqwh2JAtBBtyKrK/xHvytnEiv9n9BmKXtgcz2LTYl0mZ/B69V1VvX2bs1DQXtT1fnZYV7BPfvfmVWh5511Pi+Lc/q+XX731OncYG2wNX3+ktt2rQTJ22OaeFt9y+YSvR7uTI5U5N2nrr9Wmqo+4XkAUEWzWOHRHiuX75N89fZt7T3IgNo9L+C0XFcxutGPnR/NKbl8WH29Zi8+ZbIcztIVPJgg3577zzzov7t0812DaOX+JbJ4PqyZv+qab4613iyvP6imdufUSdJ4Ptp0k/eOfr7+nZrpu3bvzjb4nfZ2wTlYUHxdUXXOqtJ9hgK4KtGjJupjwvxI8r8mtyHW0lfeZHI23Ict+TnY1TOXZH9BfMpQvMu5JzYW4PmSLY6ia9dy1WqsEmRwbUiCGP+9Zd3OFCb/nDx0er5dZnN/fWXdG1j3f5Fe/MVuuWnzzV58vTyc+8r5Z3T17rC7ZUw41gQ7YQbNWQYWPGTj6M3tOWCxUTfoo+oRUc9D3R2T7ql8zJ2LRJmNtDpgi2ukfHWiQSiVufTrC5MgQbsoVgqwbBFrDySPTJbPZ+35OcCxOZET0wZvlrW8x7ljNhbg+ZItjqlkR71rSy5zfmZbCV9FtAsCFrCLZqEGzBUv9Xffl3vic5lyby2W6rnpDD3B4yRbDVLQsWVP8WAvW2CMefD+KmIPrnqSoX/2reVSAQBFs1CLbgVHwb3Tvle5JzcOT9iPxox4cQwtweMkWwIVbFd9HAMbcvV8d7mRfIEoKtGgRbcPLpPSvlw9ZZ88Qc5vaQKYINppIBi6L/A/S1m2+T0EOsIQwEWzUItuDIJzN5uAzzic7VseXJOcztIVMEGxKpXBjd0+b0yJd2gSwj2KpBsAVHPqmJ2Qd84ePqqPtjgTC3h0wRbKhOxSL3wq1sxAbzbgBZQ7BVg2ALjnxyM6Onuvn0iXfEK3c/Hbfuy+cn+C437l+v+dYlm8Mzt4uygr2+9emMuj8WCHN7yBTBBgDpI9iqQbAFJ51gu+nia9SRyeWBK1+680kv2HpU/XkaOfqglrF/aib2vEs79xIfPPpvtSyDbXDPAd7l5J+j0cs39Bro+/7qhmBLHcEGAOkj2KqRrWDr2K676N29v1pufE4r8ej9r3jLsydvUafTPlopJv1nkejSsafv+zMd14JNfi2PXC6DrVOTdnGXe+muJ+O+/mXyOnV6W9/B6nRwz6u988w9bK/fN0LFnFzuf36/uOupaQi21BFsAJA+gq0a2Qq2GZ+sUafjRxeIFk06iC3LKtXXF3S5RJ3KYJNTOH2nGvP7Mx2Xg00uX99rgHe5K7r2VafdWnUWs1+Z7K3f/8VGsf6Dhd5es4lPjvUFW/tGrcXa9xaoZYIt+wg2AEgfwVaNbAXbqP/7WAWZXJanA68Yopafe3ysF2sbF5eK9q3PFzcPesD3/ZmOC8Fm+xBsqSPYACB9BFs1shVs336+2bdOzsP3viiaN2knNi8t950X5OQq2Mqf3egLH1eHYEsdwQYA6SPYqpGtYMv15CrYSi6Nvvzo+lS+u51gSwPBhpqUj93m/T1O26f8zS1CHK8w7wKQNQRbNQi24JQOWa6e5Mz4cXHk/aiY8JN5F3MizO0hUwQbkjFjyLWp+HqveZeAwBFs1SDYgiWf2EqvXOgLIJcmMnWPuh+2CHN7yBTBBlPlit+izws3L/Nta65MZNLuaLj1mW/ePSBQBFs1CLZgVc7ZH42dBE96roz+P2pbhLk9ZIpgg0luS5Hpe3zbmYtDtCHbCLZqEGzBq/h4ZzR45h70PeHZPjY+IYe5PWRKB9vRo0fNs5CHxowZY66Ko/asDVjs285cHvXy6MRd5l0FAkGwVYNgyw4ZPfKJrey25b4nPBun8j87orEmPzRhmTC3h0zpYGMvW91Q3b91xec/O7+3PdGUXBx9bgOygWCrBsGWPWUvbfJeXiy7Z6Xvic+GqXh5i3cbbX0SDnN7yFRssLVr1848G3nm+PHj6t+6Xr165lmntqkE253LE5l9wNrnCriPYKvG85efipt8m9IT5r3Njci+E3FRZNtEfi81b7JVwtweMqWDrbKystq9L8gvif6t9fZlBk8+jLpfQBYQbDWYNfpk4FzqDx5XZ+QA8x7CZWFvD5kwP3Sgf5G3aNFCHDt2LOaSyDdyL1vsv72NwTak3/W+dekMwYZsIdgAh7m0PZjBJn3zzTdeuDH5P2eeeab6d88k2CY+NVb8NOkH9feFt3+6UtzQa6Do2ryjOu+pmx9Wp8Vf/yQKRk0Rbc9pKV6/b4Ra99A194hPnxwrNn64WHRrea4ofH2aeOPkeTf0GiAOTtssru8Z/RvFv07f4v0N4nSGYEO2EGyAw1zaHhIFG+qG+vXrx/3bZxps8lTGmDyVcXVLn0Hikev+17uMPO/AtE1q5Nc92nYTgy66Ul1Wr5fBFnu9eg/b2vcWEGywEsEGOMyl7YFgq5vMl0OloINNnnZu2j7ucm3ObiGuvfDKuMtUzjsg2jdspb42g01f5tym7USHxm18P7e2Q7AhWwg2wGEubQ8EW90SiUS8l0JNmQRbotHxlvMpJNiQPQQb4DCXtgeCrW5JFmtS+fvRYxv6gsfx0ceYBLKBYAMc5tL2QLDVLQ8++KC5Ko4Mm9Lrl/qix+WR96n8nW3mXQUCQbABDnNpeyDYEKe0UgVO5Jv9vvBxcbyXeYEsIdgAh7m0PRBsMFV8s1dFTtk/7PxrJ7Waqr9uUNKbWEN2EWyAw1zaHgg2JKP3Trk6vAyKMBBsgMNc2h4INtSk7Kl1oqRv9I37tk/Z42tFZK8lf+MPdQLBBjjMpe2BYAOA9BFsgMNc2h4INgBIH8EGOMyl7YFgA4D0EWyAw1zaHgg2AEgfwQY4zKXtgWADgPQRbICjDh065NT2QLABQPqcC7Zhw4apX1IMwwwVo0aNMjcRaxFsqE5kx1HfoTNsn4qJu8y7AWSNc8Emffzxx75fXAxT12b37t3mpmE1gg2JVG444gsh10b9TVQgy5wMNgDuIdjgc6zCix7fn3xyZMqfXh+9DwMXm/cOCBTBBiAUBBtiRQ6UOB1q5njhCWQJwQYgFDrYKioqzLOQh3bs2GGuiqMC55IFvvBxdqr+CHxkU5F5V4FAEGwAQqGDjb1sdUN1/9blr23Jq71remSAspcN2UKwAQhFbLAl+0WO/JLs39r1961VNwQbsoVgAxAKHWxHjx5N+osc+SfRvzXBBqSOYAMQCvNDB61bt/Z+mY8ZM0YcPnw45tLIJ82bN4/7t89msJUW7BU/f75GLVfM269Oi7/+SRyZtUMtVxYeELsnr/V9X1BDsCFbCDYAoTCDTYt9mZTJ76lXr576N89msN1/9e0q2qaP+Ei0atBMrTv2zS6x9r3oBxyGDrzL9z1BDsGGbCHYAIQiWbAh/8l/97/97W/e19kMtsLXp6vT32f8qIJt/QcL1dd7pqxXp4tHz1Kneu9b0EOwIVsINgChINjqJr13LVaYwSaX5ekvVS+DHpi2yVufjSHYkC0EG4BQEGx1T6JYk7IZbDXNgWmbfeuCHIIN2UKwAQgFwVa3yH/rv//97+ZqpXJxVdgkCB6XxwtRIAsINgChINjqln379pmr4qi4yae/dPBt1V862HHUvKtAIAg2AKEg2GCSgVM+bJ0/fhwceV/K/rXavItAYAg2AKEg2OBzvCKn72cLYsqf26huf+lNy8x7BwSKYAMQCoINiciXEHW0uTqltxJryD6CDUAoCDbUJLLrmPpLBJVz91s/vFcNYSPYAISCYAOA9BFsAEJBsAFA+gg2AKEg2AAgfQQbgFAQbACQPoINQCgINgBIH8EGIBQEGwCkj2ADEAqCDTUpfXi1KOkz33ecMxun9MFV6jAkQFgINgChINiQSOl9K09F0OAlouKNraLi3z9aP6U3L4sLOCDbCDYAoXjwwQcJNsSpmP6Lip2yB1b5/uSTMzPvINGGUBBsAEJDsEEr/cf30cgxA8jRIdqQbQQbgNDIYNuxY4e5GnnozjvvNFfFUXvW5B9MTxA/ro68T+Wjt5p3FQgEwQYgNFOmTGEvWx0h/52T/VuXj9+ZV3vX9OgPTADZQLABCFV1v8iRX/S/9dGj8X8o3Xv5MEH0uD4EG7KFYAMQOv2LfN++feZZyDP169f3BXoYwfbZ0+O85YJRU33nJ5rKwgO+dakOwYZsIdgA5MSECRO8cJMzcuRIMWfOHCYPp2/fvnF72jIJtkev+19xX//bxd6pG8SwG4Z664u//kkcPTlyuXWD5uLFO55Q0Taw++Xqe+T6Oy698eTldoqSOXtOnveemPH8BLX+kZPnH5y+RWwav1gUvPqF+Ne19/l+bm2HYEO2EGwAcmrIkCFx4cbk75x11lnq3zyTYGvVoJm3vHJsgTo9PHO76Nikrbe+zdnN1ent/W7wvkfvcevV7gJx7Juf1fI9V97mfc/hr7arYLuv/xDfz0xlCDZkC8EGAMgqHWxaUMG25r353rq+nXp463WwPTjgLu/8F+98QlTOO6BGB9vj1z8Yd90y2OTpF899KNZ/sND3s2szBBuyhWADAGRFeXm5CrV69erFrc8k2BLNi3c+6VuXaOa/Md23Ts6Wj5bGfb3rs9W+y9R2CDZkC8EGAAhccXGxijX5oQNT0ME26h/P+NblYiJf7yfYkDUEGwAgcObLoLEqJu4KNNhsmZKLOQ4bsodgAwCELui9bLmeihc2R+9PRcS8q0AgCDYAQE7IwIl8/osvflwcFaCXf2feRSAwBBsAIGf0nrbK8bt8EWT9zDv1R98rCvabdw0IFMEGAMgpHT2uTuXS38y7BASOYAMAWKF8wk5R0m+BL4hsnPJx23m/GkJFsAEAAFiOYAMAALAcwQYAAGA5gg0AAMByBBsAAIDlCDYAAADLEWwAAACWI9gAAAAsR7ABAABYjmADAACwHMEGAABgOYINAADAcgQbAACA5Qg2AAAAyxFsAAAAliPYAAAALEewAQAAWI5gAwAAsBzBBgAAYDmCDQAAwHIEGwAAgOUINgAAAMsRbAAAAJYj2AAAACxHsAEAAFiOYAMAALAcwQYAAGA5gg0AAMByBBsAAIDlCDYAAADLEWwAAACWI9gAAAAsR7ABAABYjmADAACwHMEGAABgOYINAADAcgQbAACA5Qg2AAAAyxFsAAAAliPYAAAALEewAQAAWI5gAwAAsNz/B1/oMNjLsai9AAAAAElFTkSuQmCC>