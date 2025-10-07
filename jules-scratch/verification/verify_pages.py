from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Listen for console messages and page errors
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE_ERROR: {err}"))

    print("Navigating to the home page...")
    try:
        page.goto("http://localhost:5173/", wait_until="networkidle")
        print("Navigation successful. Taking screenshot.")
        page.screenshot(path="jules-scratch/verification/01-home-page-debug.png")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)