# Google Play Store Submission Guide: WonderStories AI

This document contains the exact answers you should provide in the Google Play Console to ensure your app is approved based on the code we have implemented.

---

## 1. App Access
**Question:** Does your app require credentials or special access?
**Answer:** Select **"Yes, all or some parts of my app are restricted"**.
**Instructions for the Reviewer:** 
> "To test the full story generation and PDF fulfillment experience without making a real payment, please triple-tap the 'WonderStories' logo in the top header of the main screen. This will activate 'Reviewer Test Mode', which bypasses the parental gate and payment flow, loading a sample book with full digital access enabled."

---

## 2. Ads
**Question:** Does your app contain ads?
**Answer:** Select **"No"**.

---

## 3. Content Rating
**Questionnaire Tips:**
*   **Violence/Gore:** No.
*   **Sexuality:** No.
*   **Language:** No.
*   **User-Generated Content:** Select **"Yes"** (Because users can provide names/features for AI stories).
*   **Does the app allow users to purchase digital goods?** Select **"No"** (Because we only sell physical books via Stripe; the PDF is a free inclusion).

---

## 4. Target Audience and Content
*   **Target Age Group:** Select **"18 and over" (Parents)**. 
*   **Appeal to Children:** Select **"Yes"**.
*   **Note:** This places you in the "Family" category as a tool for parents, which is the safest path for your current Google/Stripe setup.

---

## 5. Data Safety
**Does your app collect or share any of the required user data types?** Select **"Yes"**.
**Is all of the user data collected by your app encrypted in transit?** Select **"Yes"**.
**Do you provide a way for users to request that their data is deleted?** Select **"Yes"**.

### Data Types to Declare:
1.  **Personal Info:** 
    *   **Email Address:** Used for "Account Management" and "Communication".
    *   **Name:** Used for "Account Management".
2.  **Photos and Videos:**
    *   **Photos:** Used for "App Functionality" (Character Syncing). State that photos are processed temporarily and can be deleted by the user.

---

## 6. Generative AI
**Question:** Does your app use Generative AI?
**Answer:** Select **"Yes"**.
**Compliance Declaration:**
*   Check the box confirming you have a **Reporting/Flagging** system.
*   **Description of Safety Measures:**
    > "We utilize Google Gemini AI with strict safety filters enabled. Every user-provided prompt is filtered before generation. Additionally, we provide a 'Report Inappropriate Content' feature on every story page, and our team reviews all reports within 24 hours to ensure a safe environment for families."

---

## 7. Financial Features
**Question:** Does your app provide financial features?
**Answer:** Select **"No"** (Stripe for physical goods is considered an external payment, not a 'financial feature' in this context).

---

## 8. Store Listing (Marketing)
*   **App Name:** WonderStories
*   **Short Description:** Create magical AI-powered personalized stories for your children.
*   **Full Description:** 
    > "WonderStories AI empowers parents to create unique, beautifully illustrated adventures for their children. Using advanced AI, you can sync your child's features into the story and order a high-quality physical hardcover book delivered to your door. Every physical book includes a free digital PDF edition. Our app features strict safety filters and a manual reporting system to ensure every story is safe, wholesome, and magical."

---

## 9. Privacy Policy URL
**URL:** `https://your-domain.com/privacy` 
*(Replace with your actual production URL)*

---
**Final Step:** Run `./deploy-backend.sh` before submitting to ensure the live server matches these declarations!
