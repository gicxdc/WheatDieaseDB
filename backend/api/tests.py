from django.contrib.auth import get_user_model
from django.conf import settings
from django.middleware.csrf import get_token
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from unittest.mock import patch

from .models import AuditLog, DiscussionPost, DiscussionThread, WheatDisease, WheatDiseaseImage

User = get_user_model()


class CookieJWTCSRFApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="csrfuser",
            email="csrf@example.com",
            password="SafePass123!",
        )
        self.client = APIClient(enforce_csrf_checks=True)
        access_token = str(RefreshToken.for_user(self.user).access_token)
        self.client.cookies[settings.AUTH_COOKIE_ACCESS] = access_token

    def test_cookie_jwt_write_requires_csrf_token(self):
        response = self.client.post(
            "/api/discussions/",
            {
                "title": "CSRF check",
                "board": "General discussion",
                "content": "This should fail without a CSRF token.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("CSRF Failed", str(response.data["detail"]))

    def test_cookie_jwt_write_accepts_matching_csrf_token(self):
        request = APIRequestFactory().get("/api/auth/csrf/")
        csrf_token = get_token(request)
        self.client.cookies[settings.CSRF_COOKIE_NAME] = request.META["CSRF_COOKIE"]

        response = self.client.post(
            "/api/discussions/",
            {
                "title": "CSRF check passed",
                "board": "General discussion",
                "content": "This should pass with a matching CSRF token.",
            },
            HTTP_X_CSRFTOKEN=csrf_token,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DiscussionThread.objects.filter(title="CSRF check passed").exists())


class DiscussionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="SafePass123!",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="SafePass123!",
        )
        self.expert = User.objects.create_user(
            username="expert",
            email="expert@example.com",
            password="SafePass123!",
            role="expert",
        )
        self.thread = DiscussionThread.objects.create(
            title="Thread title",
            board="General discussion",
            first_message="Opening message",
            created_by=self.user,
        )
        self.reply = DiscussionPost.objects.create(
            thread=self.thread,
            author=self.user,
            content="First reply",
        )

    def test_discussion_list_is_public(self):
        response = self.client.get("/api/discussions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], self.thread.title)
        self.assertEqual(response.data["results"][0]["replies_count"], 1)

    def test_discussion_search_does_not_duplicate_reply_count(self):
        for index in range(5):
            DiscussionPost.objects.create(
                thread=self.thread,
                author=self.user,
                content=f"Searchable reply {index}",
            )

        response = self.client.get("/api/discussions/", {"q": "reply"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["replies_count"], 6)

    def test_authenticated_user_can_create_thread(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/discussions/",
            {
                "title": "Need help identifying leaf blotch",
                "board": "Diagnosis",
                "content": "The lesions appeared after a wet week and I am unsure about the pathogen.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DiscussionThread.objects.filter(title="Need help identifying leaf blotch").exists())
        self.assertEqual(response.data["opening_post"]["author"], self.user.username)

    def test_discussion_detail_includes_opening_post_and_replies(self):
        response = self.client.get(f"/api/discussions/{self.thread.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["opening_post"]["content"], self.thread.first_message)
        self.assertEqual(len(response.data["replies"]), 1)

    def test_authenticated_user_can_reply_to_thread(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/discussions/{self.thread.id}/posts/",
            {"content": "Second reply"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DiscussionPost.objects.filter(thread=self.thread, content="Second reply").exists())

    def test_user_can_delete_own_reply(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(f"/api/discussions/{self.thread.id}/posts/{self.reply.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DiscussionPost.objects.filter(id=self.reply.id).exists())

    def test_user_cannot_delete_someone_elses_reply(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.delete(f"/api/discussions/{self.thread.id}/posts/{self.reply.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(DiscussionPost.objects.filter(id=self.reply.id).exists())

    def test_thread_creator_can_delete_own_thread(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(f"/api/discussions/{self.thread.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DiscussionThread.objects.filter(id=self.thread.id).exists())
        self.assertFalse(DiscussionPost.objects.filter(id=self.reply.id).exists())

    def test_user_cannot_delete_someone_elses_thread(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.delete(f"/api/discussions/{self.thread.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(DiscussionThread.objects.filter(id=self.thread.id).exists())

    def test_expert_can_delete_any_reply(self):
        self.client.force_authenticate(user=self.expert)

        response = self.client.delete(f"/api/discussions/{self.thread.id}/posts/{self.reply.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DiscussionPost.objects.filter(id=self.reply.id).exists())


class WheatDiseaseApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="wheatuser",
            email="wheat@example.com",
            password="SafePass123!",
        )
        self.disease = WheatDisease.objects.create(
            name="Leaf rust",
            pathogen="Puccinia triticina",
            symptoms="Orange pustules on leaves.",
            prevention="Use resistant varieties.",
            created_by=self.user,
        )
        WheatDiseaseImage.objects.create(
            disease=self.disease,
            created_by=self.user,
            image_url="http://img.example.com/stored/disease_1/leaf.jpg",
            image_key="disease_1/leaf.jpg",
            caption="leaf.jpg",
        )

    def test_disease_list_omits_embedded_images(self):
        response = self.client.get("/api/wheat-diseases/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertNotIn("images", response.data["results"][0])
        self.assertEqual(response.data["results"][0]["image_count"], 1)

    def test_disease_detail_omits_embedded_images(self):
        response = self.client.get(f"/api/wheat-diseases/{self.disease.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("images", response.data)
        self.assertEqual(response.data["image_count"], 1)

    def test_disease_images_endpoint_returns_gallery_images(self):
        response = self.client.get(f"/api/wheat-diseases/{self.disease.id}/images/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["image_key"], "disease_1/leaf.jpg")


class ImageLibraryApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="SafePass123!",
            role="admin",
        )
        self.user = User.objects.create_user(
            username="regular",
            email="regular@example.com",
            password="SafePass123!",
        )
        self.helper = User.objects.create_user(
            username="helper",
            email="helper@example.com",
            password="SafePass123!",
            role="helper",
        )
        self.disease = WheatDisease.objects.create(
            name="Leaf rust",
            pathogen="Puccinia triticina",
            symptoms="Orange pustules on leaves.",
            prevention="Use resistant varieties.",
            created_by=self.admin,
        )
        self.image = WheatDiseaseImage.objects.create(
            disease=None,
            created_by=self.admin,
            image_url="http://img.example.com/stored/unlabeled/leaf.jpg",
            image_key="unlabeled/leaf.jpg",
            caption="leaf.jpg",
        )

    @patch("api.views._call_image_backend")
    def test_admin_can_move_unlabeled_image_to_disease_folder(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            200,
            {
                "image_key": f"disease_{self.disease.id}/leaf.jpg",
                "file_url": f"http://img.example.com/stored/disease_{self.disease.id}/leaf.jpg",
            },
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            f"/api/images/{self.image.id}/move/",
            {"disease_id": self.disease.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.image.refresh_from_db()
        self.assertEqual(self.image.disease_id, self.disease.id)
        self.assertEqual(self.image.image_key, f"disease_{self.disease.id}/leaf.jpg")
        self.assertEqual(response.data["disease_name"], self.disease.name)

    @patch("api.views._call_image_backend")
    def test_admin_can_move_unlabeled_image_to_healthy_folder(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            200,
            {
                "image_key": "healthy/leaf.jpg",
                "file_url": "http://img.example.com/stored/healthy/leaf.jpg",
            },
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            f"/api/images/{self.image.id}/move/",
            {"healthy": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.image.refresh_from_db()
        self.assertIsNone(self.image.disease_id)
        self.assertEqual(self.image.image_key, "healthy/leaf.jpg")
        self.assertEqual(response.data["image_url"], "http://img.example.com/stored/healthy/leaf.jpg")
        mock_call_image_backend.assert_called_once_with(
            "/stored/unlabeled/leaf.jpg/move",
            method="POST",
            body=b'{"healthy": true}',
            content_type="application/json",
        )

    def test_regular_user_cannot_move_unlabeled_image(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/images/{self.image.id}/move/",
            {"disease_id": self.disease.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("api.views._call_image_backend")
    def test_helper_can_move_unlabeled_image_to_disease_folder(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            200,
            {
                "image_key": f"disease_{self.disease.id}/leaf.jpg",
                "file_url": f"http://img.example.com/stored/disease_{self.disease.id}/leaf.jpg",
            },
        )
        self.client.force_authenticate(user=self.helper)

        response = self.client.post(
            f"/api/images/{self.image.id}/move/",
            {"disease_id": self.disease.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.image.refresh_from_db()
        self.assertEqual(self.image.disease_id, self.disease.id)

    @patch("api.views._call_image_backend")
    def test_admin_can_delete_image_from_library(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (200, {"detail": "Stored image deleted successfully."})
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"/api/images/{self.image.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WheatDiseaseImage.objects.filter(pk=self.image.id).exists())
        mock_call_image_backend.assert_called_once_with("/stored/unlabeled/leaf.jpg", method="DELETE")

    def test_regular_user_cannot_delete_image_from_library(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(f"/api/images/{self.image.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(WheatDiseaseImage.objects.filter(pk=self.image.id).exists())

    @patch("api.views._call_image_backend")
    def test_helper_can_delete_image_from_library(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (200, {"detail": "Stored image deleted successfully."})
        self.client.force_authenticate(user=self.helper)

        response = self.client.delete(f"/api/images/{self.image.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WheatDiseaseImage.objects.filter(pk=self.image.id).exists())

    def test_empty_image_label_fields_are_saved_as_none(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            f"/api/images/{self.image.id}/",
            {
                "caption": "",
                "location": "   ",
                "background": "",
                "weather": "",
                "timeOfDay": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.image.refresh_from_db()
        self.assertEqual(self.image.caption, "None")
        self.assertEqual(self.image.location, "None")
        self.assertEqual(self.image.background, "None")
        self.assertEqual(self.image.weather, "None")
        self.assertEqual(self.image.time_of_day, "None")
        self.assertEqual(response.data["timeOfDay"], "None")

    def test_helper_can_update_image_labels(self):
        self.client.force_authenticate(user=self.helper)

        response = self.client.patch(
            f"/api/images/{self.image.id}/",
            {"caption": "Checked by helper", "location": "Field 3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.image.refresh_from_db()
        self.assertEqual(self.image.caption, "Checked by helper")
        self.assertEqual(self.image.location, "Field 3")

    @patch("api.views._call_image_backend")
    def test_admin_delete_disease_moves_images_to_unlabeled(self, mock_call_image_backend):
        disease_image = WheatDiseaseImage.objects.create(
            disease=self.disease,
            created_by=self.admin,
            image_url=f"http://img.example.com/stored/disease_{self.disease.id}/leaf.jpg",
            image_key=f"disease_{self.disease.id}/leaf.jpg",
            caption="leaf.jpg",
        )
        mock_call_image_backend.return_value = (
            200,
            {
                "image_key": "unlabeled/leaf.jpg",
                "file_url": "http://img.example.com/stored/unlabeled/leaf.jpg",
            },
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"/api/wheat-diseases/{self.disease.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WheatDisease.objects.filter(pk=self.disease.id).exists())
        disease_image.refresh_from_db()
        self.assertIsNone(disease_image.disease_id)
        self.assertEqual(disease_image.image_key, "unlabeled/leaf.jpg")
        mock_call_image_backend.assert_called_once_with(
            f"/stored/disease_{self.disease.id}/leaf.jpg/move",
            method="POST",
            body=b'{"unlabeled": true}',
            content_type="application/json",
        )

    @patch("api.views._call_image_backend")
    def test_disease_delete_stops_if_image_move_fails(self, mock_call_image_backend):
        disease_image = WheatDiseaseImage.objects.create(
            disease=self.disease,
            created_by=self.admin,
            image_url=f"http://img.example.com/stored/disease_{self.disease.id}/leaf.jpg",
            image_key=f"disease_{self.disease.id}/leaf.jpg",
            caption="leaf.jpg",
        )
        mock_call_image_backend.return_value = (500, {"detail": "Move failed."})
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"/api/wheat-diseases/{self.disease.id}/")

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertTrue(WheatDisease.objects.filter(pk=self.disease.id).exists())
        disease_image.refresh_from_db()
        self.assertEqual(disease_image.disease_id, self.disease.id)

    @patch("api.views._call_image_backend")
    def test_admin_can_bulk_delete_images_with_one_audit_log(self, mock_call_image_backend):
        second_image = WheatDiseaseImage.objects.create(
            disease=None,
            created_by=self.admin,
            image_url="http://img.example.com/stored/unlabeled/leaf-2.jpg",
            image_key="unlabeled/leaf-2.jpg",
            caption="leaf-2.jpg",
        )
        mock_call_image_backend.return_value = (200, {"detail": "Stored image deleted successfully."})
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/images/bulk-delete/",
            {"image_ids": [self.image.id, second_image.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deleted_count"], 2)
        self.assertCountEqual(response.data["deleted_image_ids"], [self.image.id, second_image.id])
        self.assertFalse(WheatDiseaseImage.objects.filter(pk__in=[self.image.id, second_image.id]).exists())
        self.assertEqual(mock_call_image_backend.call_count, 2)

        log = AuditLog.objects.get(action="wheat_disease_image.bulk_delete")
        self.assertEqual(log.changes["deleted_count"], 2)
        self.assertEqual(log.changes["deleted_by_disease"], {"unlabeled": 2})

    @patch("api.views._call_image_backend")
    def test_bulk_delete_batch_summary_writes_one_audit_log(self, mock_call_image_backend):
        skipped_image = WheatDiseaseImage.objects.create(
            disease=None,
            created_by=self.admin,
            image_url="http://img.example.com/stored/unlabeled/skipped.jpg",
            image_key="unlabeled/skipped.jpg",
            caption="skipped.jpg",
        )
        final_image = WheatDiseaseImage.objects.create(
            disease=None,
            created_by=self.admin,
            image_url="http://img.example.com/stored/unlabeled/final.jpg",
            image_key="unlabeled/final.jpg",
            caption="final.jpg",
        )
        mock_call_image_backend.return_value = (200, {"detail": "Stored image deleted successfully."})
        self.client.force_authenticate(user=self.admin)

        skipped_response = self.client.post(
            "/api/images/bulk-delete/",
            {"image_ids": [skipped_image.id], "audit_mode": "skip"},
            format="json",
        )
        summary_response = self.client.post(
            "/api/images/bulk-delete/",
            {
                "image_ids": [final_image.id],
                "audit_mode": "summary",
                "audit_prior_count": 50,
                "audit_folder": "unlabeled",
            },
            format="json",
        )

        self.assertEqual(skipped_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        logs = AuditLog.objects.filter(action="wheat_disease_image.bulk_delete")
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs.get().changes["deleted_count"], 51)
        self.assertEqual(logs.get().changes["deleted_by_disease"], {"unlabeled": 51})

    @patch("api.views._call_image_backend")
    def test_unlabeled_upload_applies_pretyped_labels(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            201,
            {
                "detail": "Saved 1 image file(s).",
                "files": [
                    {
                        "original_name": "leaf.jpg",
                        "image_key": "unlabeled/leaf.jpg",
                        "file_url": "http://img.example.com/stored/unlabeled/leaf.jpg",
                    }
                ],
            },
        )
        self.client.force_authenticate(user=self.admin)
        uploaded_file = SimpleUploadedFile("leaf.jpg", b"fake-image-data", content_type="image/jpeg")

        response = self.client.post(
            "/api/images/upload/",
            {
                "images": [uploaded_file],
                "location": "Field 3",
                "background": "Field background",
                "weather": "Cloudy",
                "timeOfDay": "Morning",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_image = WheatDiseaseImage.objects.latest("id")
        self.assertEqual(created_image.location, "Field 3")
        self.assertEqual(created_image.background, "Field background")
        self.assertEqual(created_image.weather, "Cloudy")
        self.assertEqual(created_image.time_of_day, "Morning")
        self.assertEqual(response.data["files"][0]["timeOfDay"], "Morning")

    @patch("api.views._call_image_backend")
    def test_helper_can_upload_unlabeled_images(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            201,
            {
                "detail": "Saved 1 image file(s).",
                "files": [
                    {
                        "original_name": "helper-leaf.jpg",
                        "image_key": "unlabeled/helper-leaf.jpg",
                        "file_url": "http://img.example.com/stored/unlabeled/helper-leaf.jpg",
                    }
                ],
            },
        )
        self.client.force_authenticate(user=self.helper)

        response = self.client.post(
            "/api/images/upload/",
            {"images": [SimpleUploadedFile("helper-leaf.jpg", b"fake-image-data", content_type="image/jpeg")]},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_image = WheatDiseaseImage.objects.latest("id")
        self.assertEqual(created_image.created_by, self.helper)

    @patch("api.views._call_image_backend")
    def test_helper_can_upload_images_to_disease_gallery(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            201,
            {
                "detail": "Saved 1 image file(s).",
                "files": [
                    {
                        "original_name": "disease-leaf.jpg",
                        "image_key": f"disease_{self.disease.id}/disease-leaf.jpg",
                        "file_url": f"http://img.example.com/stored/disease_{self.disease.id}/disease-leaf.jpg",
                    }
                ],
            },
        )
        self.client.force_authenticate(user=self.helper)

        response = self.client.post(
            f"/api/wheat-diseases/{self.disease.id}/images/upload/",
            {"images": [SimpleUploadedFile("disease-leaf.jpg", b"fake-image-data", content_type="image/jpeg")]},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_image = WheatDiseaseImage.objects.latest("id")
        self.assertEqual(created_image.disease_id, self.disease.id)
        self.assertEqual(created_image.created_by, self.helper)

    @patch("api.views._call_image_backend")
    def test_unlabeled_upload_batch_summary_writes_one_audit_log(self, mock_call_image_backend):
        mock_call_image_backend.return_value = (
            201,
            {
                "detail": "Saved 1 image file(s).",
                "files": [
                    {
                        "original_name": "leaf.jpg",
                        "image_key": "unlabeled/leaf.jpg",
                        "file_url": "http://img.example.com/stored/unlabeled/leaf.jpg",
                    }
                ],
            },
        )
        self.client.force_authenticate(user=self.admin)

        skipped_response = self.client.post(
            "/api/images/upload/",
            {
                "images": [SimpleUploadedFile("skip.jpg", b"fake-image-data", content_type="image/jpeg")],
                "audit_mode": "skip",
            },
        )
        summary_response = self.client.post(
            "/api/images/upload/",
            {
                "images": [SimpleUploadedFile("final.jpg", b"fake-image-data", content_type="image/jpeg")],
                "audit_mode": "summary",
                "audit_prior_count": "50",
            },
        )

        self.assertEqual(skipped_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(summary_response.status_code, status.HTTP_201_CREATED)
        logs = AuditLog.objects.filter(action="wheat_disease_image.unlabeled_upload")
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs.get().changes["uploaded_count"], 51)


class RiceDiseasePredictProxyTests(APITestCase):
    @patch("api.views._call_predict_backend")
    def test_predict_proxy_forwards_uploaded_image(self, mock_call_predict_backend):
        mock_call_predict_backend.return_value = (
            200,
            {
                "file_name": "leaf.jpg",
                "label": "Brown Spot",
                "confidence": 0.92,
                "predictions": [{"label": "Brown Spot", "confidence": 0.92}],
            },
        )
        uploaded_file = SimpleUploadedFile("leaf.jpg", b"fake-image-data", content_type="image/jpeg")

        response = self.client.post(
            "/api/predict/",
            {"image": uploaded_file, "top_k": "2"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["label"], "Brown Spot")
        mock_call_predict_backend.assert_called_once()

    def test_predict_proxy_requires_image(self):
        response = self.client.post("/api/predict/", {"top_k": "2"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("api.views.urlopen")
    @patch("api.views._call_predict_backend")
    def test_predict_proxy_can_use_existing_image_id(self, mock_call_predict_backend, mock_urlopen):
        image = WheatDiseaseImage.objects.create(
            image_url="http://img.example.com/stored/unlabeled/leaf.jpg",
            image_key="unlabeled/leaf.jpg",
            caption="leaf.jpg",
        )

        class ImageResponse:
            class Headers:
                @staticmethod
                def get_content_type():
                    return "image/jpeg"

            headers = Headers()

            @staticmethod
            def read():
                return b"fake-image-data"

        mock_urlopen.return_value = ImageResponse()
        mock_call_predict_backend.return_value = (
            200,
            {
                "file_name": "leaf.jpg",
                "label": "Leaf Blast",
                "confidence": 0.87,
                "predictions": [{"label": "Leaf Blast", "confidence": 0.87}],
            },
        )

        response = self.client.post(
            "/api/predict/",
            {"image_id": image.id, "top_k": "3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["label"], "Leaf Blast")
        mock_urlopen.assert_called_once()
        mock_call_predict_backend.assert_called_once()


class AuditLogScopeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="scopeuser",
            email="scope@example.com",
            password="SafePass123!",
        )
        self.disease = WheatDisease.objects.create(
            name="Stripe rust",
            pathogen="Puccinia striiformis",
            symptoms="Yellow stripes on wheat leaves.",
            prevention="Use resistant cultivars.",
            created_by=self.user,
        )

    def test_changelog_only_returns_wheat_disease_and_image_logs(self):
        AuditLog.objects.create(
            actor=self.user,
            action="user.update",
            resource_type="user",
            resource_id=str(self.user.id),
            changes={},
        )
        AuditLog.objects.create(
            actor=self.user,
            action="discussion_thread.create",
            resource_type="discussion_thread",
            resource_id="1",
            changes={},
        )
        disease_log = AuditLog.objects.create(
            actor=self.user,
            action="wheat_disease.update",
            resource_type="wheat_disease",
            resource_id=str(self.disease.id),
            changes={"after": {"name": self.disease.name}},
        )

        response = self.client.get("/api/changelog/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], disease_log.id)


class UserProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="oldname",
            email="oldname@example.com",
            password="SafePass123!",
        )

    def test_user_can_update_own_username(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            f"/api/user/{self.user.id}/",
            {"username": "newname"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "newname")
        self.assertEqual(response.data["username"], "newname")
