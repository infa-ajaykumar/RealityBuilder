import os
import json
import pika
from bs4 import BeautifulSoup

# RabbitMQ Configuration - Default values can be overridden by environment variables
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'rabbitmq_server')
RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.environ.get('RABBITMQ_PASS', 'password')
RABBITMQ_QUEUE = os.environ.get('RABBITMQ_QUEUE', 'property_listings_raw')
MOCK_DATA_FILE = 'mock_listings.html'

def can_fetch(url, user_agent="*"):
    """
    Placeholder for robots.txt checking.
    For this mock example, we assume we can always fetch.
    In a real scenario, this would involve fetching and parsing robots.txt.
    """
    print(f"Checking robots.txt for {url} (mock implementation - always allowed)")
    return True

def connect_to_rabbitmq():
    """Establishes a connection to RabbitMQ and returns the channel and connection."""
    print(f"Connecting to RabbitMQ server at {RABBITMQ_HOST}...")
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(RABBITMQ_HOST, credentials=credentials)
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        # Declare a durable queue
        channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
        print(f"Successfully connected to RabbitMQ and declared queue '{RABBITMQ_QUEUE}'")
        return channel, connection
    except pika.exceptions.AMQPConnectionError as e:
        print(f"Error connecting to RabbitMQ: {e}")
        return None, None

def fetch_and_parse_data():
    """Fetches data from the mock HTML file and parses it."""
    print(f"Fetching data from local file: {MOCK_DATA_FILE}")
    try:
        with open(MOCK_DATA_FILE, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"Error: Mock data file '{MOCK_DATA_FILE}' not found. Make sure it's in the same directory as the scraper.")
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    listings = []

    property_elements = soup.find_all('div', class_='property')
    if not property_elements:
        print("No elements with class 'property' found. Trying 'property-listing' div children...")
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
            print(f"Skipping an element due to missing fields: {prop_element.get_text(strip=True, separator=' | ')[:100]}")
            continue

        title = title_tag.get_text(strip=True) if title_tag else None
        price = price_tag.get_text(strip=True) if price_tag else None
        location = location_tag.get_text(strip=True) if location_tag else None
        url = url_tag['href'] if url_tag and url_tag.has_attr('href') else None
        date_posted = date_tag.get_text(strip=True) if date_tag else None

        if title and price and location and url and date_posted:
            listing = {
                'title': title,
                'price': price,
                'location': location,
                'url': url,
                'date_posted': date_posted,
                'source': 'mock_craigslist' # To identify the origin of the data
            }
            listings.append(listing)
        else:
            print(f"Skipping a property due to incomplete data. Title: {title}")

    print(f"Parsed {len(listings)} property listings.")
    return listings

def publish_to_rabbitmq(channel, data):
    """Publishes data to the RabbitMQ queue."""
    if not data:
        print("No data to publish.")
        return

    message_body = json.dumps(data)
    try:
        channel.basic_publish(
            exchange='',
            routing_key=RABBITMQ_QUEUE,
            body=message_body,
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE  # Make message persistent
            )
        )
        print(f"Sent message to queue '{RABBITMQ_QUEUE}': {data.get('title', 'N/A')}")
    except Exception as e:
        print(f"Error publishing message: {e}")


def main():
    print("Starting scraper worker...")

    # Placeholder for robots.txt check for a generic site if it were live
    if not can_fetch("http://example.com"): # Using example.com for the can_fetch placeholder
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

    print("Scraper worker finished.")

if __name__ == "__main__":
    main()
