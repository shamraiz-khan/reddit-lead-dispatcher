import os
import re
import html
import time
import threading
from datetime import datetime
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

SUBREDDITS = ["forhire", "freelance_forhire", "jobbit", "RemoteWork"]
MAX_AGE_SECONDS = 24 * 3600  # 24 Hours

EXPO_PUSH_TOKEN = os.getenv("EXPO_PUSH_TOKENS", "ExponentPushToken[YAHAN_EXPO_TOKEN_DAALEIN]")

TECH_KEYWORDS = [
    "css", "html", "javascript", "js", "python", 
    "bug", "fix", "script", "scrape", "scraping", "web",
    "developer", "dev", "react", "frontend", "backend",
    "site", "website", "automation", "api", "software",
    "app", "wordpress", "node", "nextjs", "coder", "program"
]

app = FastAPI(title="Reddit Lead Watcher - Clean Text Relay")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

seen_post_ids = set()
pending_jobs = {}

def clean_reddit_html(raw_html: str) -> str:
    """Reddit ke RSS HTML wrapper ko hata kar asal client text nikalta hai"""
    if not raw_html:
        return ""
    # Unescape HTML entities (&amp;, &lt;, etc.)
    text = html.unescape(raw_html)
    # Remove Reddit standard footer links
    text = re.sub(r'submitted by.*?\[link\].*?\[comments\]', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Clean multiple spaces & newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def craft_pitch(title: str, text: str) -> str:
    content = f"{title} {text}".lower()
    
    if any(k in content for k in ["scrape", "scraper", "scraping"]):
        focus = "your data scraping / automation requirement"
        action = "extract the clean data into CSV/Excel and set up the script"
    elif any(k in content for k in ["css", "html", "responsive", "layout"]):
        focus = "the layout / frontend CSS bug you mentioned"
        action = "inspect the DOM, fix the responsive issue, and test it across browsers"
    elif any(k in content for k in ["python", "script"]):
        focus = "the Python script issue you outlined"
        action = "debug the code, resolve the execution error, and deliver clean output"
    else:
        focus = "your web development / software project"
        action = "jump on this right away, deliver clean code, and provide quick turnaround"

    return (
        f"Hi, I saw your post regarding {focus}. "
        f"I can {action}. "
        "Available to start immediately—let me know if you'd like to discuss the details."
    )

def dispatch_expo_push(title: str, body: str, payload_data: dict):
    if not EXPO_PUSH_TOKEN or "dummy" in EXPO_PUSH_TOKEN or "YAHAN_" in EXPO_PUSH_TOKEN:
        return

    url = "https://exp.host/--/api/v2/push/send"
    payload = {
        "to": EXPO_PUSH_TOKEN,
        "title": title,
        "body": body,
        "data": payload_data,
        "sound": "default",
        "priority": "high",
    }
    try:
        requests.post(url, json=payload, timeout=8)
    except Exception as e:
        print(f"[!] Push error: {e}")

def monitor_reddit_cloud_feed():
    print(f"[*] Cloud Relay Scanner active across: {', '.join(SUBREDDITS)}...")

    while True:
        now = time.time()
        for sub in SUBREDDITS:
            try:
                reddit_feed_url = f"https://www.reddit.com/r/{sub}/new.rss"
                api_url = f"https://api.rss2json.com/v1/api.json?rss_url={reddit_feed_url}"
                
                res = requests.get(api_url, timeout=15)

                if res.status_code == 200:
                    data = res.json()
                    items = data.get("items", [])
                    print(f"[*] r/{sub}: Received {len(items)} posts from Cloud Relay")

                    for item in items:
                        post_id = item.get("guid", item.get("link", ""))
                        if not post_id or post_id in seen_post_ids:
                            continue

                        pub_date_str = item.get("pubDate", "")
                        age_seconds = 0
                        if pub_date_str:
                            try:
                                dt = datetime.strptime(pub_date_str, "%Y-%m-%d %H:%M:%S")
                                post_timestamp = dt.timestamp()
                                age_seconds = now - post_timestamp
                                if age_seconds > MAX_AGE_SECONDS:
                                    continue
                            except Exception:
                                pass

                        seen_post_ids.add(post_id)

                        title = item.get("title", "")
                        raw_desc = item.get("content", item.get("description", ""))
                        clean_body = clean_reddit_html(raw_desc)
                        author = item.get("author", "client").replace("/u/", "").strip()
                        link = item.get("link", "")

                        title_lower = title.lower()
                        body_lower = clean_body.lower()

                        is_hiring = "[hiring]" in title_lower or "hiring" in title_lower
                        has_tech = any(k in title_lower or k in body_lower for k in TECH_KEYWORDS)

                        if is_hiring and has_tech:
                            hours_ago = round(age_seconds / 3600, 1) if age_seconds else 0.5
                            print(f"\n=======================================================")
                            print(f"[+] REAL LEAD ({hours_ago}h ago) in r/{sub}:")
                            print(f"    Title:  {title}")
                            print(f"    Author: u/{author}")
                            print(f"    Body:   {clean_body[:120]}...")
                            print(f"=======================================================\n")

                            pitch = craft_pitch(title, clean_body)
                            job_payload = {
                                "id": post_id,
                                "title": f"[{hours_ago}h ago] {title}",
                                "body": clean_body,
                                "author": author,
                                "url": link,
                                "pitch": pitch,
                                "chat_url": f"https://www.reddit.com/message/compose/?to={author}&subject=Regarding your post"
                            }
                            pending_jobs[post_id] = job_payload

                            dispatch_expo_push(
                                title=f"🔥 Real Lead: u/{author}",
                                body=f"{title[:70]}...",
                                payload_data=job_payload
                            )

                else:
                    print(f"[!] Relay status {res.status_code} on r/{sub}")

            except Exception as e:
                print(f"[!] Error checking r/{sub}: {e}")

            time.sleep(3)
        time.sleep(12)

@app.get("/")
def home():
    return {"status": "running", "jobs_ready": len(pending_jobs)}

@app.get("/jobs")
def get_jobs():
    return list(pending_jobs.values())

@app.get("/trigger-test")
def trigger_test():
    test_id = f"test_{int(time.time())}"
    job_payload = {
        "id": test_id,
        "title": "[Hiring] Need Python Developer to scrape data and fix CSS layout",
        "body": "Looking for a developer to scrape 500 product listings into CSV and fix responsive layout bugs on our web page.",
        "author": "sample_client",
        "url": "https://www.reddit.com/r/forhire",
        "pitch": "Hi, I saw your post regarding your data scraping and CSS layout fix. I can jump on this right away and complete it within 1-2 hours. Available to start immediately!",
        "chat_url": "https://www.reddit.com/message/compose/?to=sample_client&subject=Regarding your post"
    }
    pending_jobs[test_id] = job_payload
    dispatch_expo_push(
        title="🔥 Test Lead Triggered",
        body="[Hiring] Need Python Developer to scrape data...",
        payload_data=job_payload
    )
    return {"status": "success", "message": "Test job injected"}

if __name__ == "__main__":
    import uvicorn
    t = threading.Thread(target=monitor_reddit_cloud_feed, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=8000)