from rest_framework.permissions import BasePermission, SAFE_METHODS

#perm cho admin/expert
class IsExpertOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return getattr(user, "role", None) in ("admin", "expert")


class IsImageHelperOrExpertOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return getattr(user, "role", None) in ("admin", "expert", "helper")

#perm cho self hoặc admin
class IsSelfOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if getattr(request.user, "role", None) == "admin":
            return True

        return obj.id == request.user.id

#perm admin only
class IsAdminOnly(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        return getattr(user, "role", None) == "admin"
