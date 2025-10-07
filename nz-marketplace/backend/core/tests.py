from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

User = get_user_model()

class UserRegistrationTests(APITestCase):
    def test_registration(self):
        """
        Ensure we can create a new user account.
        """
        url = reverse('register')
        data = {'username': 'testuser', 'password': 'testpassword', 'email': 'test@example.com'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().username, 'testuser')

class ListingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.client.force_authenticate(user=self.user)

    def test_create_listing(self):
        """
        Ensure we can create a new listing.
        """
        url = reverse('listing-list')
        data = {'title': 'Test Listing', 'description': 'A test description', 'price': '100.00', 'location': 'Auckland', 'uploaded_images': []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_get_listings(self):
        """
        Ensure we can retrieve a list of listings.
        """
        url = reverse('listing-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)