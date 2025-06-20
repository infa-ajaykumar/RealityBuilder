import os
import json
import pika
from bs4 import BeautifulSoup
import random # For proxy selection

# RabbitMQ Configuration - Default values can be overridden by environment variables
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'rabbitmq_server')
RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.environ.get('RABBITMQ_PASS', 'password')
RABBITMQ_QUEUE = os.environ.get('RABBITMQ_QUEUE', 'property_listings_raw')
MOCK_DATA_FILE = 'mock_listings.html'

# Proxy Configuration
HTTP_PROXIES_STRING = os.environ.get('HTTP_PROXIES', '')
PROXIES_LIST = [p.strip() for p in HTTP_PROXIES_STRING.split(',') if p.strip()]

def get_proxy_config():
    """Selects a random proxy from the list if available."""
    if PROXIES_LIST:
        selected_proxy_url = random.choice(PROXIES_LIST)
        print(f"Using proxy: {selected_proxy_url}")
        return {"http": selected_proxy_url, "https": selected_proxy_url}
    return None

def can_fetch(url, user_agent="*"):
    print(f"Checking robots.txt for {url} (mock implementation - always allowed)")
    return True

def connect_to_rabbitmq():
    print(f"Connecting to RabbitMQ server at {RABBITMQ_HOST}...")
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(RABBITMQ_HOST, credentials=credentials)
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
        print(f"Successfully connected to RabbitMQ and declared queue '{RABBITMQ_QUEUE}'")
        return channel, connection
    except pika.exceptions.AMQPConnectionError as e:
        print(f"Error connecting to RabbitMQ: {e}")
        return None, None

def fetch_and_parse_data():
    print(f"Fetching data from local file: {MOCK_DATA_FILE}")

    # Conceptual proxy usage for when using requests.get()
    # current_proxies = get_proxy_config() # Get proxy for this request attempt
    # if current_proxies:
    #     print(f"Conceptually, this request would use proxy: {current_proxies.get('http')}")
    # else:
    #     print("Conceptually, this request would be direct (no proxy).")

    # try:
    #     # Example of how it would be used with requests:
    #     # import requests
    #     # response = requests.get("http://example.com/listings_page", proxies=current_proxies, timeout=10)
    #     # response.raise_for_status() # Check for HTTP errors
    #     # html_content = response.text
    # except requests.exceptions.RequestException as e:
    #     print(f"Error fetching data with requests: {e}")
    #     # Handle error: maybe try another proxy, or if all fail, return empty list
    #     return []


    try:
        with open(MOCK_DATA_FILE, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"Error: Mock data file '{MOCK_DATA_FILE}' not found.")
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    listings = []

    property_elements = soup.find_all('div', class_='property')
    if not property_elements:
        listing_container = soup.find('div', class_='property-listing')
        if listing_container:
            property_elements = listing_container.find_all('div', recursive=False)

    for prop_element in property_elements:
        title_tag = prop_element.find('h2', class_='title')
        price_tag = prop_element.find('p', class_='price')
        location_tag = prop_element.find('p', class_='location')
        url_tag = prop_element.find('a', class_='url')
        date_tag = prop_element.find('span', class_='date-posted')

        if not all([title_tag, price_tag, location_tag, url_tag, date_tag]):
            continue

        title = title_tag.get_text(strip=True) if title_tag else None
        price = price_tag.get_text(strip=True) if price_tag else None
        location = location_tag.get_text(strip=True) if location_tag else None
        url = url_tag['href'] if url_tag and url_tag.has_attr('href') else None
        date_posted = date_tag.get_text(strip=True) if date_tag else None

        if title and price and location and url and date_posted:
            listing = {
                'title': title,
                'price': price, # Will be parsed as price_text by data_processing
                'location': location, # Will be parsed as location_text by data_processing
                'url': url,
                'date_posted': date_posted,
                'source': 'mock_craigslist'
            }
            listings.append(listing)

    print(f"Parsed {len(listings)} property listings.")
    return listings

def publish_to_rabbitmq(channel, data):
    if not data:
        print("No data to publish.")
        return
    message_body = json.dumps(data)
    try:
        channel.basic_publish(
            exchange='',
            routing_key=RABBITMQ_QUEUE,
            body=message_body,
            properties=pika.BasicProperties(delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE)
        )
        print(f"Sent message to queue '{RABBITMQ_QUEUE}': {data.get('title', 'N/A')}")
    except Exception as e:
        print(f"Error publishing message: {e}")

def main():
    print("Starting Python scraper worker (craigslist_scraper)...")

    # Conceptual: If using proxies with actual requests, one might be selected here or per request.
    # For this script, we'll just print if proxies are configured to show it's being read.
    if PROXIES_LIST:
        print(f"Proxies configured: {len(PROXIES_LIST)} proxies available (e.g., {PROXIES_LIST[0]}).")
        # A proxy would be chosen by get_proxy_config() if making actual web requests.
    else:
        print("No HTTP_PROXIES configured. Direct connection would be used for web requests.")

    if not can_fetch("http://example.com"):
        print("Scraping disallowed by robots.txt. Exiting.")
        return

    channel, connection = connect_to_rabbitmq()
    if not channel or not connection:
        print("Could not connect to RabbitMQ. Exiting.")
        return

    listings = fetch_and_parse_data()

    if not listings:
        print("No listings found or parsed. Exiting.")
    else:
        for listing in listings:
            publish_to_rabbitmq(channel, listing)
        print(f"Finished publishing {len(listings)} listings.")

    if connection and not connection.is_closed:
        try:
            connection.close()
            print("RabbitMQ connection closed.")
        except Exception as e:
            print(f"Error closing RabbitMQ connection: {e}")

    print("Python scraper worker finished.")

if __name__ == "__main__":
    main()
