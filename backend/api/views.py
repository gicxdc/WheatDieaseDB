import random
import json
import mimetypes
from math import ceil
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import ensure_csrf_cookie
from .serializers import (
    AuditLogSerializer,
    PublicAuditLogSerializer,
    AdminUserRoleSerializer,
    DiscussionPostSerializer,
    DiscussionReplyCreateSerializer,
    DiscussionThreadCreateSerializer,
    DiscussionThreadDetailSerializer,
    DiscussionThreadListSerializer,
    ForgotPasswordConfirmSerializer,
    ForgotPasswordRequestSerializer,
    LoginSerializer,
    RegisterSerializer,
    VerifyOTPSerializer,
    WheatDiseaseListSerializer,
    WheatDiseaseSerializer,
    UserSerializer,
    WheatDiseaseImageSerializer
)
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import (
    AuditLog,
    DiscussionPost,
    DiscussionThread,
    PasswordResetOTP,
    WheatDisease,
    WheatDiseaseImage,
)
from django.shortcuts import get_object_or_404
from django.db.models import Count, Max, Q
from .permission import (IsAdminOnly, IsExpertOrAdmin, IsImageHelperOrExpertOrAdmin, IsSelfOrAdmin)
User = get_user_model()

#check perm
def _can_manage_owned_content(user, owner):
    if not user or not user.is_authenticated:
        return False

    if getattr(user, "role", None) in ("admin", "expert"):
        return True

    return owner is not None and owner.id == user.id

#xây header cho img backend
def _image_backend_headers():
    headers = {}
    if settings.IMAGE_BACKEND_API_KEY:
        headers["Authorization"] = f"Bearer {settings.IMAGE_BACKEND_API_KEY}"
    return headers

#gọi img backend
def _call_image_backend(path, method="GET", body=None, content_type=None):
    headers = _image_backend_headers()
    if content_type:
        headers["Content-Type"] = content_type

    #tạo request
    request = Request(
        f"{settings.IMAGE_BACKEND_BASE_URL}{path}",
        data=body,
        headers=headers,
        method=method,
    )

    try:
        #gủi request và đọc response
        response = urlopen(request, timeout=settings.IMAGE_BACKEND_TIMEOUT)
        payload = response.read()
        return response.status, json.loads(payload.decode("utf-8")) if payload else {}
    except HTTPError as exc:
        #sử lý lỗi HTTP
        payload = exc.read()
        try:
            data = json.loads(payload.decode("utf-8")) if payload else {}
        except json.JSONDecodeError:
            data = {}
        return exc.code, data
    #sử lý lỗi URL
    except URLError:
        return None, {"detail": "Could not connect to the image backend."}

#giống trên nhưng predict
def _call_predict_backend(path, method="GET", body=None, content_type=None):
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type

    request = Request(
        f"{settings.PREDICT_BACKEND_BASE_URL}{path}",
        data=body,
        headers=headers,
        method=method,
    )

    try:
        response = urlopen(request, timeout=settings.PREDICT_BACKEND_TIMEOUT)
        payload = response.read()
        return response.status, json.loads(payload.decode("utf-8")) if payload else {}
    except HTTPError as exc:
        payload = exc.read()
        try:
            data = json.loads(payload.decode("utf-8")) if payload else {}
        except json.JSONDecodeError:
            data = {}
        return exc.code, data
    except URLError:
        return None, {"detail": "Could not connect to the prediction backend."}

#xây mulipart form data
def _encode_multipart_formdata(fields, files):
    boundary = "WHEATDBBOUNDARY123456789"
    lines = []

    #phần text
    for name, value in fields.items():
        lines.extend(
            [
                f"--{boundary}".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"'.encode("utf-8"),
                b"",
                str(value).encode("utf-8"),
            ]
        )

    #phần file
    for file_field, uploaded_file in files:
        lines.extend(
            [
                f"--{boundary}".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{file_field}"; '
                    f'filename="{uploaded_file.name}"'
                ).encode("utf-8"),
                f"Content-Type: {uploaded_file.content_type or 'application/octet-stream'}".encode("utf-8"),
                b"",
                uploaded_file.read(),
            ]
        )

    lines.append(f"--{boundary}--".encode("utf-8"))
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"

#lấy image key từ URL lưu vào db
def _stored_image_key_from_url(image_url):
    if not image_url:
        return ""

    parsed = urlparse(str(image_url))
    path = parsed.path or ""
    marker = "/stored/"
    marker_index = path.find(marker)
    if marker_index < 0:
        return ""

    return unquote(path[marker_index + len(marker):].lstrip("/"))


def _get_actor(request):
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return user
    return None


def _get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")

#ghi vào audit log
def _audit_log(request, action, resource_type, resource_id="", changes=None):
    #chỉ ghi log liên quan đến bệnh và ảnh bệnh
    allowed_resource_types = {"wheat_disease", "wheat_disease_image"}
    
    if resource_type not in allowed_resource_types:
        return
    #tạo audit log trên db
    AuditLog.objects.create(
        actor=_get_actor(request),
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else "",
        method=request.method if request else "",
        path=request.path if request else "",
        ip_address=_get_client_ip(request) if request else "",
        changes=json.loads(json.dumps(changes or {}, cls=DjangoJSONEncoder)),
    )


def home(request):
    return JsonResponse({"message": "welcome,welcome", "status": "ok"})


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


class RegisterView(APIView):
    #check perm
    permission_classes = [AllowAny]

    #post requests tạo tài khoản mới
    def post(self, request):
        #tạo serializer và validate data
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        #tạo user và trả về response
        user = serializer.save()
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            },
            status=status.HTTP_201_CREATED,
        )
    
class LoginView(APIView):
    #check perm
    permission_classes = [AllowAny]

    #post request để đăng nhập 
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        response = Response(
            {
                "detail": "Login successful.",
                "user": data["user"],
            },
            status=status.HTTP_200_OK,
        )

        #trả về cookie
        response.set_cookie(
            settings.AUTH_COOKIE_ACCESS,
            data["access"],
            max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            path="/",
        )
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            data["refresh"],
            max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            path="/",
        )

        return response


class ForgotPasswordRequestView(APIView):
    #check perm
    permission_classes = [AllowAny]

    def post(self, request):
        #tao serializer và validate data
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.get(email=serializer.validated_data["email"])
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        #tạo mã otp
        otp_code = f"{random.randint(0, 999999):06d}"
        otp_record = PasswordResetOTP.objects.create(
            user=user,
            otp_code=otp_code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        #gửi OTP đến email
        send_mail(
            subject="WheatDB password reset OTP",
            message=(
                f"Your WheatDB OTP is {otp_record.otp_code}. "
                "It expires in 10 minutes."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return Response(
            {"detail": "OTP sent to email."},
            status=status.HTTP_200_OK,
        )


class ForgotPasswordConfirmView(APIView):
    #check perm
    permission_classes = [AllowAny]


    def post(self, request):
        serializer = ForgotPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        #validate 
        user = serializer.validated_data["user"]
        otp_record = serializer.validated_data["otp_record"]

        #set pass mới
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        #đánh dấu đã dùng OTP
        otp_record.is_used = True
        otp_record.save(update_fields=["is_used"])

        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        #verify OTP 
        otp_record = serializer.validated_data["otp_record"]
        otp_record.is_verified = True
        otp_record.save(update_fields=["is_verified"])

        return Response(
            {"detail": "OTP verified successfully."},
            status=status.HTTP_200_OK,
        )

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        #lấy token
        refresh_token = request.data.get("refresh") or request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not refresh_token:
            return Response({"detail": "refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            #blacklist token
            token.blacklist()
            response = Response({"detail": "logged out"}, status=status.HTTP_205_RESET_CONTENT)
            #xóa access và refresh khỏi cookie
            response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
            response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")
            return response
        
        except TokenError:
            return Response({"detail": "invalid or expired refresh token"}, status=status.HTTP_400_BAD_REQUEST)


class RiceDiseasePredictView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uploaded_file = request.FILES.get("image")
        image_id = request.data.get("image_id")

        if not uploaded_file and image_id:
            image = get_object_or_404(WheatDiseaseImage, pk=image_id)
            if not image.image_url:
                return Response(
                    {"detail": "The selected image does not have a readable URL."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                image_response = urlopen(image.image_url, timeout=settings.PREDICT_BACKEND_TIMEOUT)
                image_bytes = image_response.read()
            except (HTTPError, URLError):
                return Response(
                    {"detail": "Could not read the selected image for prediction."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            file_name = image.image_key.rsplit("/", 1)[-1] if image.image_key else f"image-{image.id}.jpg"
            uploaded_file = ContentFile(image_bytes, name=file_name)
            uploaded_file.content_type = (
                image_response.headers.get_content_type()
                or mimetypes.guess_type(file_name)[0]
                or "image/jpeg"
            )

        if not uploaded_file:
            return Response(
                {"detail": "Upload an image file using the 'image' form field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body, content_type = _encode_multipart_formdata(
            {"top_k": request.data.get("top_k", "3")},
            [("image", uploaded_file)],
        )
        upstream_status, upstream_data = _call_predict_backend(
            "/predict/",
            method="POST",
            body=body,
            content_type=content_type,
        )

        if upstream_status is None:
            return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

        return Response(upstream_data, status=upstream_status)



class WheatDiseaseListCreateView(APIView):
    #check perm nếu get thì ai cx đc
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsExpertOrAdmin()]

    def get(self, request):
        #lấy all sort theo name
        queryset = (
            WheatDisease.objects.select_related("created_by")
            .annotate(image_count=Count("images", distinct=True))
            .order_by("name")
        )
        #filter
        choices = str(request.query_params.get("choices", "")).lower() in ("1", "true", "yes")
        query = (request.query_params.get("q") or "").strip()
        raw_fields = (request.query_params.get("fields") or "").strip()
        letter = (request.query_params.get("letter") or "ALL").strip().upper()
       
        page = request.query_params.get("page", "1")
        page_size = request.query_params.get("page_size", "10")

        #trả về form đơn giản
        if choices:
            return Response(
                [{"id": disease.id, "name": disease.name} for disease in queryset],
                status=status.HTTP_200_OK,
            )
        

        #map field tìm kiếm
        allowed_fields = {
            "name": "name",
            "condition": "condition",
            "symptoms": "symptoms",
            "prevention": "prevention",
            "created_by": "created_by__username",
            "pathogen": "pathogen",
        }

        if query:
            #check query field
            requested_fields = [
                field.strip() for field in raw_fields.split(",") if field.strip()
            ]

            fields = [
                allowed_fields[field]
                for field in requested_fields
                if field in allowed_fields
            ]

            if not fields:
                fields = [
                    allowed_fields["name"],
                    allowed_fields["condition"],
                    allowed_fields["symptoms"],
                    allowed_fields["prevention"],
                    allowed_fields["created_by"],
                ]

            search_filter = Q()
            for field_name in fields:
                search_filter |= Q(**{f"{field_name}__icontains": query})
            
            #search
            queryset = queryset.filter(search_filter)
        
        #filter chữ đầu
        if letter != "ALL":
            queryset = queryset.filter(name__istartswith=letter)
        
        #pagination
        try:
            page = int(page)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 10

        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        total_count = queryset.count()
        total_pages = max(1, ceil(total_count / page_size)) if total_count > 0 else 1
        current_page = min(page, total_pages)
        offset = (current_page - 1) * page_size
        paged_queryset = queryset[offset:offset + page_size]


        serializer = WheatDiseaseListSerializer(paged_queryset, many=True)
        return Response(
            {
                "count": total_count,
                "current_page": current_page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = WheatDiseaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        disease = serializer.save(created_by=request.user)
        response_data = WheatDiseaseSerializer(disease).data
        #ghi log
        _audit_log(
            request,
            action="wheat_disease.create",
            resource_type="wheat_disease",
            resource_id=disease.id,
            changes={"after": response_data},
        )
        return Response(response_data, status=status.HTTP_201_CREATED)


class WheatDiseaseDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsExpertOrAdmin()]

    def get(self, request, pk):
        #get bệnh hoặc trả về 404
        disease = get_object_or_404(
            WheatDisease.objects.select_related("created_by").annotate(image_count=Count("images", distinct=True)),
            pk=pk,
        )
        serializer = WheatDiseaseListSerializer(disease)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        disease = get_object_or_404(WheatDisease, pk=pk)
        disease.image_count = disease.images.count()
        before_data = WheatDiseaseListSerializer(disease).data
        #upd
        serializer = WheatDiseaseSerializer(disease, data=request.data)
        serializer.is_valid(raise_exception=True)
        disease = serializer.save()
        disease.image_count = disease.images.count()
        after_data = WheatDiseaseListSerializer(disease).data
        #ghi log
        _audit_log(
            request,
            action="wheat_disease.replace",
            resource_type="wheat_disease",
            resource_id=disease.id,
            changes={"before": before_data, "after": after_data},
        )
        return Response(after_data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        disease = get_object_or_404(WheatDisease, pk=pk)
        disease.image_count = disease.images.count()
        before_data = WheatDiseaseListSerializer(disease).data
        serializer = WheatDiseaseSerializer(disease, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        disease = serializer.save()
        disease.image_count = disease.images.count()
        after_data = WheatDiseaseListSerializer(disease).data
        _audit_log(
            request,
            action="wheat_disease.update",
            resource_type="wheat_disease",
            resource_id=disease.id,
            changes={
                "fields": list(request.data.keys()),
                "before": before_data,
                "after": after_data,
            },
        )
        return Response(after_data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        #kiếm bệnh cần xóa
        disease = get_object_or_404(WheatDisease, pk=pk)
        before_data = WheatDiseaseSerializer(disease).data
        moved_images = []

        #di chuyển ảnh từ gallery riêng sang unlabeled 
        for image in list(disease.images.all()):
            image_before_data = WheatDiseaseImageSerializer(image).data

            if image.image_key:
                #tạo request đến image backend để di chuyển ảnh sang gallery unlabeled
                body = json.dumps({"unlabeled": True}).encode("utf-8")
                upstream_status, upstream_data = _call_image_backend(
                    f"/stored/{image.image_key}/move",
                    method="POST",
                    body=body,
                    content_type="application/json",
                )
                #check connect status
                if upstream_status is None:
                    return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

                if upstream_status >= 400:
                    return Response(
                        upstream_data or {"detail": "Could not move disease images to unlabeled."},
                        status=upstream_status,
                    )

                #update lại trên db
                image.image_key = upstream_data["image_key"]
                image.image_url = upstream_data["file_url"]

            image.disease = None
            image.save(update_fields=["disease", "image_key", "image_url"])
            moved_images.append(
                {
                    "id": image.id,
                    "before": image_before_data,
                    "after": WheatDiseaseImageSerializer(image).data,
                }
            )
        #xóa bệnh
        disease.delete()
        #ghi log
        _audit_log(
            request,
            action="wheat_disease.delete",
            resource_type="wheat_disease",
            resource_id=pk,
            changes={
                "before": before_data,
                "moved_image_count": len(moved_images),
                "moved_images": moved_images,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def get_object(self, pk):
        return get_object_or_404(User, pk=pk)


class WheatDiseaseImageLibraryView(APIView):
    permission_classes = [AllowAny]
    #gallery
    def get(self, request):
        images = WheatDiseaseImage.objects.select_related("disease", "created_by").order_by("image_key", "-uploaded_at")
        serializer = WheatDiseaseImageSerializer(images, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WheatDiseaseImageLibraryDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsImageHelperOrExpertOrAdmin()]

    def get(self, request, image_id):
        #get img thuộc về bệnh
        image = get_object_or_404(WheatDiseaseImage.objects.select_related("disease", "created_by"), pk=image_id)
        serializer = WheatDiseaseImageSerializer(image)
        return Response(serializer.data, status=status.HTTP_200_OK)

    #update metadata
    def patch(self, request, image_id):
        image = get_object_or_404(WheatDiseaseImage, pk=image_id)
        before_data = WheatDiseaseImageSerializer(image).data
        serializer = WheatDiseaseImageSerializer(image, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        after_data = serializer.data
        _audit_log(
            request,
            action="wheat_disease_image.label_update",
            resource_type="wheat_disease_image",
            resource_id=image.id,
            changes={
                "fields": list(request.data.keys()),
                "before": before_data,
                "after": after_data,
            },
        )
        return Response(after_data, status=status.HTTP_200_OK)

    def delete(self, request, image_id):
        image = get_object_or_404(WheatDiseaseImage, pk=image_id)
        before_data = WheatDiseaseImageSerializer(image).data
        disease_id = image.disease_id

        if image.image_key:
            upstream_status, upstream_data = _call_image_backend(
                f"/stored/{image.image_key}",
                method="DELETE",
            )
            if upstream_status is None:
                return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)
            if upstream_status not in (200, 404):
                return Response(
                    upstream_data or {"detail": "Could not delete the stored image file."},
                    status=upstream_status,
                )

        image.delete()
        _audit_log(
            request,
            action="wheat_disease_image.delete",
            resource_type="wheat_disease_image",
            resource_id=image_id,
            changes={
                "disease_id": disease_id,
                "before": before_data,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WheatDiseaseImageBulkDeleteView(APIView):
    def get_permissions(self):
        return [IsImageHelperOrExpertOrAdmin()]

    #post thay vì delete 
    def post(self, request):
        image_ids = request.data.get("image_ids", [])

        if not isinstance(image_ids, list):
            return Response({"detail": "image_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        normalized_image_ids = []
        for image_id in image_ids:
            if str(image_id).isdigit():
                normalized_image_ids.append(int(image_id))

        if not normalized_image_ids:
            return Response({"detail": "Choose at least one image to delete."}, status=status.HTTP_400_BAD_REQUEST)

        images = list(WheatDiseaseImage.objects.filter(pk__in=normalized_image_ids).select_related("disease", "created_by"))
        found_image_ids = {image.id for image in images}
        deleted_image_ids = []
        failed_images = []
        deleted_by_disease = {}

        for image in images:
            before_data = WheatDiseaseImageSerializer(image).data

            if image.image_key:
                upstream_status, upstream_data = _call_image_backend(
                    f"/stored/{image.image_key}",
                    method="DELETE",
                )
                if upstream_status is None:
                    failed_images.append(
                        {
                            "id": image.id,
                            "image_key": image.image_key,
                            "detail": upstream_data.get("detail", "Could not connect to the image backend."),
                        }
                    )
                    continue

                if upstream_status not in (200, 404):
                    failed_images.append(
                        {
                            "id": image.id,
                            "image_key": image.image_key,
                            "detail": (upstream_data or {}).get("detail", "Could not delete the stored image file."),
                        }
                    )
                    continue

            deleted_image_id = image.id
            disease_key = str(image.disease_id) if image.disease_id else "unlabeled"
            deleted_by_disease[disease_key] = deleted_by_disease.get(disease_key, 0) + 1
            image.delete()
            deleted_image_ids.append(deleted_image_id)

        missing_image_ids = [image_id for image_id in normalized_image_ids if image_id not in found_image_ids]
        for image_id in missing_image_ids:
            failed_images.append(
                {
                    "id": image_id,
                    "detail": "Image not found.",
                }
            )

        audit_mode = request.data.get("audit_mode", "")
        
        try:
            audit_prior_count = max(0, int(request.data.get("audit_prior_count", 0)))
        except (TypeError, ValueError):
            audit_prior_count = 0
        
        #đếm ảnh ghi audit
        should_audit_delete = bool(deleted_image_ids) or (audit_mode == "summary" and audit_prior_count > 0)
        if should_audit_delete and audit_mode != "skip":
            audit_deleted_count = len(deleted_image_ids)
            audit_deleted_by_disease = deleted_by_disease
            if audit_mode == "summary":
                audit_deleted_count += audit_prior_count
                if request.data.get("audit_folder") == "unlabeled":
                    audit_deleted_by_disease = {"unlabeled": audit_deleted_count}

            _audit_log(
                request,
                action="wheat_disease_image.bulk_delete",
                resource_type="wheat_disease_image",
                changes={
                    "deleted_count": audit_deleted_count,
                    "image_ids": deleted_image_ids,
                    "failed_count": len(failed_images),
                    "deleted_by_disease": audit_deleted_by_disease,
                    "batched": audit_mode == "summary",
                },
            )

        response_status = status.HTTP_200_OK if not failed_images else status.HTTP_207_MULTI_STATUS
        return Response(
            {
                "detail": f"Deleted {len(deleted_image_ids)} image(s).",
                "deleted_count": len(deleted_image_ids),
                "deleted_image_ids": deleted_image_ids,
                "failed": failed_images,
            },
            status=response_status,
        )

#giống upload thường+metadata
class WheatDiseaseImageUnlabeledUploadView(APIView):
    def get_permissions(self):
        return [IsImageHelperOrExpertOrAdmin()]

    def post(self, request):
        files = request.FILES.getlist("images")
        if not files and "image" in request.FILES:
            files = [request.FILES["image"]]

        if not files:
            return Response({"detail": "No image files were uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        upload_labels = {
            "location": request.data.get("location", ""),
            "background": request.data.get("background", request.data.get("angle", "")),
            "weather": request.data.get("weather", ""),
            "time_of_day": request.data.get("timeOfDay", request.data.get("time_of_day", "")),
        }

        body, content_type = _encode_multipart_formdata(
            {"unlabeled": "true"},
            [("images", uploaded_file) for uploaded_file in files],
        )
        upstream_status, upstream_data = _call_image_backend(
            "/uploads",
            method="POST",
            body=body,
            content_type=content_type,
        )

        if upstream_status is None:
            return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

        if upstream_status >= 400:
            return Response(
                upstream_data or {"detail": "Upload failed on the image backend."},
                status=upstream_status,
            )

        created_images = []
        for file_data in upstream_data.get("files", []):
            image = WheatDiseaseImage.objects.create(
                disease=None,
                created_by=request.user,
                image_url=file_data["file_url"],
                image_key=file_data["image_key"],
                caption=file_data.get("original_name", ""),
                location=upload_labels["location"],
                background=upload_labels["background"],
                weather=upload_labels["weather"],
                time_of_day=upload_labels["time_of_day"],
                is_primary=False,
            )
            created_images.append(image)

        serializer = WheatDiseaseImageSerializer(created_images, many=True)
        audit_mode = request.data.get("audit_mode", "")
        try:
            audit_prior_count = max(0, int(request.data.get("audit_prior_count", 0)))
        except (TypeError, ValueError):
            audit_prior_count = 0

        if audit_mode != "skip":
            _audit_log(
                request,
                action="wheat_disease_image.unlabeled_upload",
                resource_type="wheat_disease_image",
                changes={
                    "uploaded_count": len(created_images) + audit_prior_count,
                    "image_ids": [image.id for image in created_images],
                    "batched": audit_mode == "summary",
                },
            )
        return Response(
            {
                "detail": upstream_data.get("detail", f"Saved {len(created_images)} image file(s)."),
                "files": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

#chuyển từ unlabeled sang gallery bệnh 
class WheatDiseaseImageMoveView(APIView):
    def get_permissions(self):
        return [IsImageHelperOrExpertOrAdmin()]

    def post(self, request, image_id):
        image = get_object_or_404(WheatDiseaseImage, pk=image_id)
        disease_id = request.data.get("disease_id")
        move_to_healthy = str(request.data.get("healthy", "")).lower() in ("1", "true", "yes")

        if not move_to_healthy and not str(disease_id or "").isdigit():
            return Response({"detail": "A numeric disease_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        disease = None if move_to_healthy else get_object_or_404(WheatDisease, pk=disease_id)
        before_data = WheatDiseaseImageSerializer(image).data

        if image.disease_id is not None or not str(image.image_key or "").startswith("unlabeled/"):
            return Response(
                {"detail": "Only unlabeled images can be moved to a disease or healthy folder."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body_payload = {"healthy": True} if move_to_healthy else {"disease_id": disease.id}
        body = json.dumps(body_payload).encode("utf-8")
        upstream_status, upstream_data = _call_image_backend(
            f"/stored/{image.image_key}/move",
            method="POST",
            body=body,
            content_type="application/json",
        )

        if upstream_status is None:
            return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

        if upstream_status >= 400:
            return Response(
                upstream_data or {"detail": "Could not move the stored image file."},
                status=upstream_status,
            )

        image.disease = None if move_to_healthy else disease
        image.image_key = upstream_data["image_key"]
        image.image_url = upstream_data["file_url"]
        image.save(update_fields=["disease", "image_key", "image_url"])

        after_data = WheatDiseaseImageSerializer(image).data
        _audit_log(
            request,
            action="wheat_disease_image.move",
            resource_type="wheat_disease_image",
            resource_id=image.id,
            changes={
                "disease_id": disease.id if disease else None,
                "target_folder": "healthy" if move_to_healthy else f"disease_{disease.id}",
                "before": before_data,
                "after": after_data,
            },
        )
        return Response(after_data, status=status.HTTP_200_OK)


class UserAvatarUploadView(APIView):
    permission_classes = [IsSelfOrAdmin]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        self.check_object_permissions(request, user)

        uploaded_file = request.FILES.get("image")
        if not uploaded_file:
            return Response({"detail": "No image file was uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        body, content_type = _encode_multipart_formdata(
            {"user_id": str(user.id)},
            [("image", uploaded_file)],
        )
        upstream_status, upstream_data = _call_image_backend(
            "/uploads",
            method="POST",
            body=body,
            content_type=content_type,
        )

        if upstream_status is None:
            return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

        if upstream_status >= 400:
            return Response(
                upstream_data or {"detail": "Upload failed on the image backend."},
                status=upstream_status,
            )

        uploaded_files = upstream_data.get("files", [])
        if not uploaded_files:
            return Response({"detail": "The image backend did not return an uploaded file."}, status=status.HTTP_502_BAD_GATEWAY)

        uploaded_avatar = uploaded_files[0]
        previous_avatar = {
            "avatar_url": user.avatar_url,
        }
        previous_avatar_key = _stored_image_key_from_url(user.avatar_url)

        if previous_avatar_key and previous_avatar_key != uploaded_avatar["image_key"]:
            delete_status, delete_data = _call_image_backend(
                f"/stored/{previous_avatar_key}",
                method="DELETE",
            )
            if delete_status not in (None, 200, 404):
                return Response(
                    delete_data or {"detail": "The new avatar uploaded, but the old avatar could not be deleted."},
                    status=delete_status,
                )

        user.avatar_url = uploaded_avatar["file_url"]
        user.save(update_fields=["avatar_url"])

        response_data = UserSerializer(user).data
        _audit_log(
            request,
            action="user.avatar_upload",
            resource_type="user",
            resource_id=user.id,
            changes={
                "before": previous_avatar,
                "after": {
                    "avatar_url": user.avatar_url,
                },
            },
        )
        return Response(
            {
                "detail": upstream_data.get("detail", "Avatar uploaded successfully."),
                "user": response_data,
            },
            status=status.HTTP_200_OK,
        )


    
class UserDetailView(APIView):
    permission_classes = [IsSelfOrAdmin]

    def get_object(self, pk):
        return get_object_or_404(User, pk=pk)

    def get(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        before_data = UserSerializer(user).data
        serializer = UserSerializer(user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        after_data = serializer.data
        _audit_log(
            request,
            action="user.replace",
            resource_type="user",
            resource_id=user.id,
            changes={"before": before_data, "after": after_data},
        )
        return Response(after_data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        before_data = UserSerializer(user).data
        serializer = UserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        after_data = serializer.data
        _audit_log(
            request,
            action="user.update",
            resource_type="user",
            resource_id=user.id,
            changes={
                "fields": list(request.data.keys()),
                "before": before_data,
                "after": after_data,
            },
        )
        return Response(after_data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        before_data = UserSerializer(user).data
        user.delete()
        _audit_log(
            request,
            action="user.delete",
            resource_type="user",
            resource_id=pk,
            changes={"before": before_data},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListView(APIView):
    permission_classes = [IsExpertOrAdmin]

    def get(self, request):
        page = request.query_params.get("page", "1")
        page_size = request.query_params.get("page_size", "10")

        try:
            page = int(page)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 20

        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        queryset = User.objects.all().order_by("username")
        role_filter = (request.query_params.get("role") or "").strip()
        email_filter = (request.query_params.get("email") or "").strip()
        username_filter = (request.query_params.get("username") or "").strip()

        if role_filter:
            queryset = queryset.filter(role=role_filter)
        if email_filter:
            queryset = queryset.filter(email__icontains=email_filter)
        if username_filter:
            queryset = queryset.filter(username__icontains=username_filter)

        total_count = queryset.count()
        total_pages = max(1, ceil(total_count / page_size)) if total_count > 0 else 1
        current_page = min(page, total_pages)
        offset = (current_page - 1) * page_size
        paged_queryset = queryset[offset:offset + page_size]
        serializer = UserSerializer(paged_queryset, many=True)

        return Response(
            {
                "count": total_count,
                "current_page": current_page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class UserRoleUpdateView(APIView):
    permission_classes = [IsAdminOnly]

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        previous_role = user.role
        serializer = AdminUserRoleSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response_data = UserSerializer(user).data
        _audit_log(
            request,
            action="user.role_update",
            resource_type="user",
            resource_id=user.id,
            changes={
                "before": {"role": previous_role},
                "after": {"role": user.role},
            },
        )
        return Response(response_data, status=status.HTTP_200_OK)


class ChangeLogListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        page = request.query_params.get("page", "1")
        page_size = request.query_params.get("page_size", "10")
        date_from_filter = (request.query_params.get("date_from") or "").strip()
        date_to_filter = (request.query_params.get("date_to") or "").strip()
        actor_filter = (request.query_params.get("actor") or "").strip()
        change_filter = (request.query_params.get("change") or "").strip()

        try:
            page = int(page)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 20

        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        queryset = AuditLog.objects.filter(
            resource_type__in=("wheat_disease", "wheat_disease_image")
        ).order_by("-created_at")

        date_from = parse_date(date_from_filter) if date_from_filter else None
        date_to = parse_date(date_to_filter) if date_to_filter else None
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        if actor_filter:
            queryset = queryset.filter(actor__username__icontains=actor_filter)

        if change_filter:
            if change_filter == "create":
                queryset = queryset.filter(
                    Q(action__endswith=".create")
                    | Q(action="wheat_disease_image.bulk_upload")
                    | Q(action="wheat_disease_image.unlabeled_upload")
                )
            elif change_filter == "delete":
                queryset = queryset.filter(action__icontains="delete")
            elif change_filter == "update":
                queryset = queryset.filter(
                    Q(action__icontains="update")
                    | Q(action__endswith=".replace")
                    | Q(action="wheat_disease_image.label_update")
                    | Q(action="wheat_disease_image.move")
                )

        total_count = queryset.count()
        total_pages = max(1, ceil(total_count / page_size)) if total_count > 0 else 1
        current_page = min(page, total_pages)
        offset = (current_page - 1) * page_size
        paged_queryset = queryset[offset:offset + page_size]
        can_view_technical = (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) in ("admin", "expert")
        )
        serializer_class = AuditLogSerializer if can_view_technical else PublicAuditLogSerializer
        serializer = serializer_class(paged_queryset, many=True)

        return Response(
            {
                "count": total_count,
                "current_page": current_page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class DiscussionThreadListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        board = (request.query_params.get("board") or "All boards").strip()
        page = request.query_params.get("page", "1")
        page_size = request.query_params.get("page_size", "10")

        queryset = (
            DiscussionThread.objects.select_related("created_by")
            .prefetch_related("posts__author")
            .annotate(replies_count=Count("posts", distinct=True), latest_reply_at=Max("posts__created_at"))
        )

        if board and board != "All boards":
            queryset = queryset.filter(board__iexact=board)

        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(board__icontains=query)
                | Q(first_message__icontains=query)
                | Q(created_by__username__icontains=query)
                | Q(posts__author__username__icontains=query)
                | Q(posts__content__icontains=query)
            ).distinct()

        threads = list(queryset)
        threads.sort(
            key=lambda thread: (
                thread.latest_reply_at or thread.created_at,
                thread.created_at,
            ),
            reverse=True,
        )

        try:
            page = int(page)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 10

        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        total_count = len(threads)
        total_pages = max(1, ceil(total_count / page_size)) if total_count > 0 else 1
        current_page = min(page, total_pages)
        offset = (current_page - 1) * page_size
        paged_threads = threads[offset:offset + page_size]
        serializer = DiscussionThreadListSerializer(paged_threads, many=True)

        return Response(
            {
                "count": total_count,
                "current_page": current_page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = DiscussionThreadCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        thread = serializer.save()
        response_data = DiscussionThreadDetailSerializer(thread).data
        _audit_log(
            request,
            action="discussion_thread.create",
            resource_type="discussion_thread",
            resource_id=thread.id,
            changes={"after": response_data},
        )
        return Response(response_data, status=status.HTTP_201_CREATED)


class DiscussionThreadDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        thread = get_object_or_404(
            DiscussionThread.objects.select_related("created_by").prefetch_related("posts__author"),
            pk=pk,
        )
        serializer = DiscussionThreadDetailSerializer(thread)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        thread = get_object_or_404(
            DiscussionThread.objects.select_related("created_by"),
            pk=pk,
        )

        if not _can_manage_owned_content(request.user, thread.created_by):
            return Response(
                {"detail": "You do not have permission to delete this thread."},
                status=status.HTTP_403_FORBIDDEN,
            )

        thread_snapshot = DiscussionThreadDetailSerializer(thread).data
        thread.delete()
        _audit_log(
            request,
            action="discussion_thread.delete",
            resource_type="discussion_thread",
            resource_id=pk,
            changes={"before": thread_snapshot},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DiscussionReplyCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        thread = get_object_or_404(DiscussionThread, pk=pk)
        serializer = DiscussionReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        post = DiscussionPost.objects.create(
            thread=thread,
            author=request.user,
            content=serializer.validated_data["content"],
        )
        response_data = DiscussionPostSerializer(post).data
        _audit_log(
            request,
            action="discussion_post.create",
            resource_type="discussion_post",
            resource_id=post.id,
            changes={
                "thread_id": thread.id,
                "after": response_data,
            },
        )
        return Response(response_data, status=status.HTTP_201_CREATED)


class DiscussionPostDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, post_id):
        thread = get_object_or_404(DiscussionThread, pk=pk)
        post = get_object_or_404(
            DiscussionPost.objects.select_related("author", "thread"),
            pk=post_id,
            thread=thread,
        )

        if not _can_manage_owned_content(request.user, post.author):
            return Response(
                {"detail": "You do not have permission to delete this reply."},
                status=status.HTTP_403_FORBIDDEN,
            )

        post_snapshot = DiscussionPostSerializer(post).data
        post.delete()
        _audit_log(
            request,
            action="discussion_post.delete",
            resource_type="discussion_post",
            resource_id=post_id,
            changes={
                "thread_id": thread.id,
                "before": post_snapshot,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)





class WheatDiseaseImageListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsImageHelperOrExpertOrAdmin()]

    def get(self, request, pk):
        disease = get_object_or_404(WheatDisease, pk=pk)
        serializer = WheatDiseaseImageSerializer(
            disease.images.all().order_by("-is_primary", "-uploaded_at"),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        disease = get_object_or_404(WheatDisease, pk=pk)
        serializer = WheatDiseaseImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.save(disease=disease, created_by=request.user)
        response_data = WheatDiseaseImageSerializer(image).data

        _audit_log(
            request,
            action="wheat_disease_image.create",
            resource_type="wheat_disease_image",
            resource_id=image.id,
            changes={
                "disease_id": disease.id,
                "after": response_data,
            },
        )
        return Response(response_data, status=status.HTTP_201_CREATED)


class WheatDiseaseImageUploadView(APIView):
    def get_permissions(self):
        return [IsImageHelperOrExpertOrAdmin()]

    def post(self, request, pk):
        disease = get_object_or_404(WheatDisease, pk=pk)
        #get files
        files = request.FILES.getlist("images")
        if not files:
            return Response({"detail": "No image files were uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        #tạo request
        body, content_type = _encode_multipart_formdata(
            {"disease_id": str(disease.id)},
            [("images", uploaded_file) for uploaded_file in files],
        )
        #gửi request đến image backend
        upstream_status, upstream_data = _call_image_backend(
            "/uploads",
            method="POST",
            body=body,
            content_type=content_type,
        )

        if upstream_status is None:
            return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)

        if upstream_status >= 400:
            return Response(
                upstream_data or {"detail": "Upload failed on the image backend."},
                status=upstream_status,
            )

        created_images = []
        for file_data in upstream_data.get("files", []):
            # url va key nhét vào db
            image = WheatDiseaseImage.objects.create(
                disease=disease,
                created_by=request.user,
                image_url=file_data["file_url"],
                image_key=file_data["image_key"],
                caption="",
                is_primary=False,
            )
            created_images.append(image)

        serializer = WheatDiseaseImageSerializer(created_images, many=True)
        _audit_log(
            request,
            action="wheat_disease_image.bulk_upload",
            resource_type="wheat_disease",
            resource_id=disease.id,
            changes={
                "uploaded_count": len(created_images),
                "image_ids": [image.id for image in created_images],
            },
        )

        return Response(
            {
                "detail": upstream_data.get("detail", f"Saved {len(created_images)} image file(s)."),
                "files": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class WheatDiseaseImageDetailView(APIView):
    def get_permissions(self):
        return [IsImageHelperOrExpertOrAdmin()]

    def delete(self, request, pk, image_id):
        disease = get_object_or_404(WheatDisease, pk=pk)
        image = get_object_or_404(WheatDiseaseImage, pk=image_id, disease=disease)
        before_data = WheatDiseaseImageSerializer(image).data

        if image.image_key:
            upstream_status, upstream_data = _call_image_backend(
                f"/stored/{image.image_key}",
                method="DELETE",
            )
            if upstream_status is None:
                return Response(upstream_data, status=status.HTTP_502_BAD_GATEWAY)
            if upstream_status not in (200, 404):
                return Response(
                    upstream_data or {"detail": "Could not delete the stored image file."},
                    status=upstream_status,
                )

        image.delete()
        _audit_log(
            request,
            action="wheat_disease_image.delete",
            resource_type="wheat_disease_image",
            resource_id=image_id,
            changes={
                "disease_id": disease.id,
                "before": before_data,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

class Test(APIView):
    def get_permissions(self):
        return [AllowAny()]
    
    def get(self,request):
        querry=User.objects.all()
        return Response({
            "list":querry.values()
        })
    
    def post(self,request):
        serializer=RegisterSerializer(data=request.data)
        validated_data=serializer.is_valid(raise_exception=True)
        user=serializer.save()
        return Response({
            "name":user.username
        })
    
   
