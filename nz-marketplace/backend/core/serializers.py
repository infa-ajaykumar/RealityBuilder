from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_verified_seller')

class ListingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingImage
        fields = ('id', 'image')

class ListingSerializer(serializers.ModelSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False, use_url=False),
        write_only=True
    )

    class Meta:
        model = Listing
        fields = ('id', 'seller', 'title', 'description', 'price', 'location', 'images', 'uploaded_images', 'created_at', 'updated_at')
        read_only_fields = ('seller',)

    def create(self, validated_data):
        uploaded_images = validated_data.pop("uploaded_images")
        listing = Listing.objects.create(**validated_data)
        for image in uploaded_images:
            ListingImage.objects.create(listing=listing, image=image)
        return listing

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name', 'role', 'photo_proof')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=validated_data.get('role', User.Role.BUYER)
        )
        if 'photo_proof' in validated_data:
            user.photo_proof = validated_data['photo_proof']
            user.save()
        return user