from django.contrib import admin
from .models import User, Listing, ListingImage

class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 1

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_verified_seller', 'is_staff')
    list_filter = ('role', 'is_verified_seller', 'is_staff')
    search_fields = ('username', 'email')
    actions = ['verify_seller']

    def verify_seller(self, request, queryset):
        queryset.update(is_verified_seller=True)
    verify_seller.short_description = "Mark selected sellers as verified"

@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('title', 'seller', 'price', 'location', 'created_at')
    list_filter = ('location', 'created_at')
    search_fields = ('title', 'description', 'seller__username')
    inlines = [ListingImageInline]

@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):
    list_display = ('listing', 'image')
    search_fields = ('listing__title',)