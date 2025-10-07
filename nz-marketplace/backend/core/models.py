from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        BUYER = 'BUYER', 'Buyer'
        SELLER_PRIVATE = 'SELLER_PRIVATE', 'Private Seller'
        SELLER_IN_TRADE = 'SELLER_IN_TRADE', 'In-Trade Seller'
        ADMIN = 'ADMIN', 'Admin'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BUYER)
    photo_proof = models.ImageField(upload_to='verification/', null=True, blank=True)
    is_verified_seller = models.BooleanField(default=False)

class Listing(models.Model):
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listings')
    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    location = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='listings/')

    def __str__(self):
        return f"Image for {self.listing.title}"