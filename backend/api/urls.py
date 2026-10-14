from django.urls import path
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import home, RegisterView
from .views import LogoutView
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    csrf,
    ForgotPasswordConfirmView,
    ForgotPasswordRequestView,
    DiscussionPostDetailView,
    DiscussionReplyCreateView,
    DiscussionThreadDetailView,
    DiscussionThreadListCreateView,
    home,
    RegisterView,
    LoginView,
    LogoutView,
    RiceDiseasePredictView,
    VerifyOTPView,
    WheatDiseaseImageLibraryDetailView,
    WheatDiseaseImageBulkDeleteView,
    WheatDiseaseImageLibraryView,
    WheatDiseaseImageMoveView,
    WheatDiseaseImageDetailView,
    WheatDiseaseImageListCreateView,
    WheatDiseaseImageUnlabeledUploadView,
    WheatDiseaseImageUploadView,
    WheatDiseaseListCreateView,
    WheatDiseaseDetailView,
    UserDetailView,
    UserAvatarUploadView,
    UserListView,
    UserRoleUpdateView,
    ChangeLogListView,
    Test
)


# test view
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "avatar_url": u.avatar_url,
                "date_joined": u.date_joined,
                "datejoined": u.date_joined,
            }
        )


# api end point
urlpatterns = [
    path("", home),
    path("auth/csrf/", csrf, name="csrf"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path(
        "auth/forgot-password/",
        ForgotPasswordRequestView.as_view(),
        name="forgot-password",
    ),
    path("auth/verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("predict/", RiceDiseasePredictView.as_view(), name="rice-disease-predict"),
    path(
        "auth/reset-password/",
        ForgotPasswordConfirmView.as_view(),
        name="reset-password",
    ),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    
    
    path(
        "wheat-diseases/",
        WheatDiseaseListCreateView.as_view(),
        name="wheat-disease-list",
    ),
    path(
        "wheat-diseases/<int:pk>/",
        WheatDiseaseDetailView.as_view(),
        name="wheat-disease-detail",
    ),
    path(
        "wheat-diseases/<int:pk>/images/",
        WheatDiseaseImageListCreateView.as_view(),
        name="wheat-disease-image-list",
    ),
    path(
        "wheat-diseases/<int:pk>/images/upload/",
        WheatDiseaseImageUploadView.as_view(),
        name="wheat-disease-image-upload",
    ),
    path(
        "wheat-diseases/<int:pk>/images/<int:image_id>/",
        WheatDiseaseImageDetailView.as_view(),
        name="wheat-disease-image-detail",
    ),


    path("images/", WheatDiseaseImageLibraryView.as_view(), name="image-library"),
    path(
        "images/bulk-delete/",
        WheatDiseaseImageBulkDeleteView.as_view(),
        name="image-bulk-delete",
    ),
    path(
        "images/<int:image_id>/",
        WheatDiseaseImageLibraryDetailView.as_view(),
        name="image-library-detail",
    ),
    path(
        "images/<int:image_id>/move/",
        WheatDiseaseImageMoveView.as_view(),
        name="image-move",
    ),
    path(
        "images/upload/",
        WheatDiseaseImageUnlabeledUploadView.as_view(),
        name="image-unlabeled-upload",
    ),


    
    path("users/", UserListView.as_view(), name="user-list"),
    path(
        "users/<int:pk>/avatar/upload/",
        UserAvatarUploadView.as_view(),
        name="user-avatar-upload",
    ),
    path("users/<int:pk>/role/", UserRoleUpdateView.as_view(), name="user-role-update"),
    path("changelog/", ChangeLogListView.as_view(), name="changelog-list"),
    path("user/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path(
        "discussions/",
        DiscussionThreadListCreateView.as_view(),
        name="discussion-thread-list",
    ),
    path(
        "discussions/<int:pk>/",
        DiscussionThreadDetailView.as_view(),
        name="discussion-thread-detail",
    ),
    path(
        "discussions/<int:pk>/posts/",
        DiscussionReplyCreateView.as_view(),
        name="discussion-post-create",
    ),
    path(
        "discussions/<int:pk>/posts/<int:post_id>/",
        DiscussionPostDetailView.as_view(),
        name="discussion-post-detail",
    ),path("test/",Test.as_view(),name="Test")
    
]
