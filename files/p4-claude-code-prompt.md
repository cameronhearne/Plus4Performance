Restructure the Plus 4 Performance website from a single sales page into a multi-page brand site. Inspect the repo first to understand the current stack, file structure, styling approach and image assets, and work within that stack. Do not change the design language.

CONTEXT
- Current homepage (/) is the sales page for our 16-week guaranteed coaching offer. It must keep working exactly as it does now.
- We are adding a brand home page, a clothing shop (print-on-demand, fulfilled manually by us) and supporting pages.
- Coaches: Cameron and Ethan. Tone: plain-spoken, like a mate who trains talking to you. No marketing speak.
- Pricing is NOT shown anywhere on the new pages. Coaching is "Price on application", sold via a call.

1. MOVE THE SALES PAGE
- Move the current homepage content to /guaranteed-coaching, unchanged except: replace the pricing section figures (£995 and 4 x £275) with "Price on application. We'll go through it on your call." and keep the booking CTA.
- Its in-page links (How It Works, Guarantee, Pricing, FAQ) become a secondary sub-nav on that page only.
- Update meta title/description/OG tags for the new URL.

2. SHARED LAYOUT
- One shared header and footer used on every page.
- Header: logo + PLUS4PERFORMANCE wordmark ("4" in accent) linking to / | Guaranteed Coaching | Shop | About | "Book a Call" outlined pill button linking to the existing TidyCal URL.
- Mobile: hamburger menu, Book a Call stays visible.
- Footer: wordmark + "Average to Elite." then columns:
  Coaching: Guaranteed Coaching, Book a Call, Guarantee Terms
  Shop: Clothing, Size Guide, Shipping & Returns
  Company: About, Instagram, TikTok (placeholder URLs)
  Legal: Privacy Policy, Terms
  Bottom: © 2026 Plus 4 Performance. All rights reserved.

3. NEW HOME PAGE (/)  Use this copy exactly.
a) Hero
   Eyebrow: ONLINE COACHING · CLOTHING
   H1: "You already train. Let's make it show." ("Let's make it show." in accent)
   Sub: "We're Cameron and Ethan. We coach lads who are in the gym every week but aren't seeing it in the mirror. We also make the clothes we train in."
   Buttons: "Guaranteed Coaching" (filled, /guaranteed-coaching), "Shop Clothing" (outlined, /shop)
   Right half: hero.jpg (provided, already duotoned)
b) "What we do." with two cards side by side (stack on mobile), image on top:
   Card 1 image: coaching-card.jpg (provided)
     Eyebrow: 16-WEEK GUARANTEED COACHING
     Heading: "Hit your goal or get your money back."
     Body: "We check every session you log, go through your form on video and check in with you twice a week. You do your part, and if you still don't hit your goal, you get a full refund."
     Left: "Price on application"  Button: "Book a Call" (TidyCal)
   Card 2 image: placeholder [PHOTO: US WEARING P4 CLOTHING]
     Eyebrow: CLOTHING
     Heading: "What we train in."
     Body: "We designed it for ourselves first. Made to order and delivered to your door."
     Left: "From £[PRICE]"  Button: "Shop Now" (/shop)
c) Why Plus 4
   Eyebrow: WHY PLUS 4
   H2: "Do a bit more than everyone else. Every week."
   Three columns:
   +4 Reps: "Most people stop when it gets hard. The progress is in the reps after that."
   +4% Effort: "A little more each week doesn't feel like much. Over 16 weeks it's the difference."
   +4 Discipline: "Hitting your food, steps and sleep on the days you can't be bothered."
d) Results
   Eyebrow: RESULTS
   H2: "We've done it ourselves."
   Sub: "Tap a photo to see where we started."
   Two cards (Cameron, Ethan). Each card shows a NOW photo; clicking/tapping flips it (3D card flip, respect prefers-reduced-motion with a simple crossfade) to the BEFORE photo, and back again. Small pill label on the photo: "NOW" / "BEFORE". Under the photo: name on the left, "Tap to see before" / "Tap to see now" on the right.
   Must be a real <button> with aria-label and aria-pressed, keyboard accessible.
   Drive it from one data array (name, nowImage, beforeImage). Photos not supplied yet: render labelled placeholders until images are added.
e) Your Coaches (id="about")
   Eyebrow: YOUR COACHES
   H2: "Who you'll be working with."
   Paragraph: "[YEARS] years of training between us. We've both been the lad putting the work in and not seeing it change. We sorted that for ourselves first. Now we do it for our clients."
   Two equal columns: photo placeholder, name (Cameron / Ethan), one-line placeholder under each.
f) Email sign-up
   H2: "Hear about new drops first."
   Body: "New clothing, coaching spaces when they open, and the odd training tip. No spam."
   Labelled email input + "Sign Up" button. POST to [LEAD CAPTURE ENDPOINT] if set via env var, otherwise show a success state without submitting. Include validation and success/error states.

4. SHOP (/shop and /shop/[slug])
- Products in ONE data file (name, slug, price, description, sizes, images, stripePaymentLink). Seed 2 placeholder products.
- /shop: responsive grid (3 to 4 columns desktop, 2 mobile): image, name, price.
- /shop/[slug]: image gallery, name, price, description, sizes, "Made to order. Ships in [X] working days.", "Buy Now" button to that product's Stripe Payment Link (new tab). Links to Size Guide and Shipping & Returns.
- No cart, no checkout code, no database. Stripe handles payment.

5. SUPPORTING PAGES
- /about: placeholder copy blocks for Cameron and Ethan's story.
- /guarantee-terms, /shipping-returns, /terms, /size-guide: simple readable layouts with [PLACEHOLDER] content. Shipping & Returns needs a placeholder section for the 14-day cancellation right on UK online orders.
- Keep the existing /privacy page.

6. DESIGN RULES
- Reuse existing colours, fonts, spacing, blue duotone photo treatment, button styles and scroll reveals. Extract shared values into CSS variables if not already.
- Dark canvas, single restrained blue accent. No new colours.
- Fully responsive (390px, 768px, 1440px). Touch targets 44px minimum. WCAG AA contrast.
- Semantic HTML, alt text on all images.

7. SEO AND ROUTING
- Unique title, description, OG tags per page. Add all new pages to the sitemap.
- Redirect old anchors (/#pricing etc.) to /guaranteed-coaching#... where the stack allows.

8. PROCESS
- Summarise the current stack and your plan first, then build.
- Do NOT commit or push. When finished, list every file changed, every placeholder to fill, and how to preview locally.
- No em dashes anywhere in copy.
