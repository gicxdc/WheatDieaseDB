from django.contrib import admin
from .models import DiscussionPost, DiscussionThread


@admin.register(DiscussionThread)
class DiscussionThreadAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "board", "created_by", "created_at")
    search_fields = ("title", "board", "first_message", "created_by__username")
    list_filter = ("board", "created_at")


@admin.register(DiscussionPost)
class DiscussionPostAdmin(admin.ModelAdmin):
    list_display = ("id", "thread", "author", "created_at")
    search_fields = ("thread__title", "content", "author__username")
    list_filter = ("created_at",)
