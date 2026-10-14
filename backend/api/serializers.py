from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.utils import timezone
from .models import (
    AuditLog,
    DiscussionPost,
    DiscussionThread,
    PasswordResetOTP,
    WheatDisease,
    WheatDiseaseImage,
)
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken
#convert data to db object
#handle CRUD    

User = get_user_model()

#sử lý register 
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role")

    #tạo mới user
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
    
    #check pass
    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

#sử lý login
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
   
   
    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        try:
            user = User.objects.get(email=email)
        #check user tồn tại
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid email or password"})
        #check pass
        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid email or password"})
        #check active
        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is disabled"})

        #tạo token
        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "avatar_url": user.avatar_url,
                "date_joined": user.date_joined,
                "datejoined": user.date_joined,
            },
        }

#sử lý validate email cho forget password 
class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No user found with this email address.")
        return value

#sử lý verify otp
class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs):
        email = attrs["email"]
        otp = attrs["otp"]

        try:
            user = User.objects.get(email=email)
        #check user tồn tại
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "No user found with this email address."})

        #kiếm mã OTP hơp lệ
        otp_record = PasswordResetOTP.objects.filter(
            user=user,
            otp_code=otp,
            is_used=False,
        ).order_by("-created_at").first()

        #check mã OTP tồn tại
        if otp_record is None:
            raise serializers.ValidationError({"otp": "Invalid OTP."})

        #check mã OTP đã hết hạn
        if otp_record.expires_at <= timezone.now():
            raise serializers.ValidationError({"otp": "OTP has expired."})

        attrs["otp_record"] = otp_record
        return attrs


#sử lý reset password
class ForgotPasswordConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        try:       
            #validate pass mới
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, attrs):
        email = attrs["email"]

        try:
            user = User.objects.get(email=email)
        #check user tồn tại
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "No user found with this email address."})

        #kiếm mã OTP đã được verify
        otp_record = PasswordResetOTP.objects.filter(
            user=user,
            is_verified=True,
            is_used=False,
        ).order_by("-created_at").first()
        
        #check mã OTP tồn tại
        if otp_record is None:
            raise serializers.ValidationError({"detail": "OTP verification is required before resetting password."})

        #check mã OTP đã hết hạn
        if otp_record.expires_at <= timezone.now():
            raise serializers.ValidationError({"detail": "Verified OTP has expired. Request a new OTP."})

        attrs["user"] = user
        attrs["otp_record"] = otp_record
        return attrs

#sử lý user hiện tại
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role", "first_name", "last_name", "avatar_url")
        read_only_fields = ("id", "role")

#sử lý thay đổi role của user bởi admin
class AdminUserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "role")
        read_only_fields = ("id",)

#sử lý bệnh cây lúa
class WheatDiseaseSerializer(serializers.ModelSerializer):
    created_by = serializers.SlugRelatedField(read_only=True, slug_field="username")
    images = serializers.SerializerMethodField()
    
    class Meta:
        model = WheatDisease
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    #lấy images của bệnh cây lúa
    def get_images(self, obj):
        serializer = WheatDiseaseImageSerializer(
            obj.images.all().order_by("-is_primary", "-uploaded_at"),
            many=True,
        )
        return serializer.data


class WheatDiseaseListSerializer(serializers.ModelSerializer):
    created_by = serializers.SlugRelatedField(read_only=True, slug_field="username")
    image_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = WheatDisease
        fields = (
            "id",
            "name",
            "pathogen",
            "condition",
            "symptoms",
            "prevention",
            "created_by",
            "created_at",
            "updated_at",
            "image_count",
        )
        read_only_fields = fields

#sử lý ảnh bệnh cây lúa
class WheatDiseaseImageSerializer(serializers.ModelSerializer):
    created_by = serializers.SlugRelatedField(read_only=True, slug_field="username")
    disease_id = serializers.IntegerField(source="disease.id", read_only=True)
    disease_name = serializers.CharField(source="disease.name", read_only=True)
    timeOfDay = serializers.CharField(source="time_of_day", required=False, allow_blank=True)

    class Meta:
        model = WheatDiseaseImage
        fields = (
            "id",
            "created_by",
            "disease_id",
            "disease_name",
            "image_url",
            "image_key",
            "caption",
            "location",
            "background",
            "weather",
            "timeOfDay",
            "is_primary",
            "uploaded_at",
        )
        read_only_fields = ("id", "created_by", "uploaded_at")

#sử lý log
class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_username",
            "action",
            "resource_type",
            "resource_id",
            "method",
            "path",
            "ip_address",
            "changes",
            "created_at",
        )
    #lấy username 
    def get_actor_username(self, obj):
        return obj.actor.username if obj.actor else "system"

#sử lý ghi log
class PublicAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_username",
            "message",
            "created_at",
        )

    #kiểm tra username của actor 
    def get_actor_username(self, obj):
        return obj.actor.username if obj.actor else "system"
    
    #tạo label
    def _resource_label(self, obj):
        resource = (obj.resource_type or "bản ghi").replace("_", " ")
        if obj.resource_id:
            return f"{resource} #{obj.resource_id}"
        return resource

    #lấy tên 
    def _extract_name(self, payload):
        if not isinstance(payload, dict):
            return None
        return payload.get("name") or payload.get("username")

    #tạo message log
    def get_message(self, obj):
        changes = obj.changes if isinstance(obj.changes, dict) else {}
        before = changes.get("before", {})
        after = changes.get("after", {})
        
        #tạo label 
        resource_label = self._resource_label(obj)

        #readable message 
        if obj.action == "wheat_disease.create":
            disease_name = self._extract_name(after)
            return f"Đã tạo bệnh lúa \"{disease_name}\"." if disease_name else "Đã tạo một mục bệnh lúa."

        #readable message
        if obj.action in ("wheat_disease.update", "wheat_disease.replace"):
            disease_name = self._extract_name(after) or self._extract_name(before)
            return f"Đã cập nhật bệnh lúa \"{disease_name}\"." if disease_name else f"Đã cập nhật {resource_label}."

        #readable message
        if obj.action == "wheat_disease.delete":
            disease_name = self._extract_name(before)
            return f"Đã xóa bệnh lúa \"{disease_name}\"." if disease_name else f"Đã xóa {resource_label}."

        #readable message
        if obj.action == "wheat_disease_image.create":
            disease_id = changes.get("disease_id")
            return f"Đã thêm hình ảnh vào bệnh lúa #{disease_id}." if disease_id else "Đã thêm hình ảnh."

        #readable message
        if obj.action == "wheat_disease_image.bulk_upload":
            disease_id = changes.get("disease_id") or obj.resource_id
            #đếm số ảnh được upload
            uploaded_count = changes.get("uploaded_count")
            if uploaded_count:
                if disease_id:
                    return f"Đã tải lên {uploaded_count} hình ảnh cho bệnh lúa #{disease_id}."
                return f"Đã tải lên {uploaded_count} hình ảnh."
            return f"Đã tải lên hình ảnh cho bệnh lúa #{disease_id}."
        
        #readable message
        if obj.action == "wheat_disease_image.unlabeled_upload":
            uploaded_count = changes.get("uploaded_count")
            return f"Đã tải lên {uploaded_count} hình ảnh chưa gán nhãn." if uploaded_count else "Đã tải lên hình ảnh chưa gán nhãn."
        
        #readable message
        if obj.action == "wheat_disease_image.bulk_delete":
            deleted_count = changes.get("deleted_count")
            deleted_by_disease = changes.get("deleted_by_disease", {})
            if deleted_count and isinstance(deleted_by_disease, dict) and set(deleted_by_disease.keys()) == {"unlabeled"}:
                return f"Đã xóa {deleted_count} hình ảnh chưa gán nhãn."
            return f"Đã xóa {deleted_count} hình ảnh." if deleted_count else "Đã xóa hình ảnh."

        #readable message
        if obj.action == "wheat_disease_image.move":
            disease_id = changes.get("disease_id")
            if changes.get("healthy"):
                return "Đã chuyển hình ảnh vào thư viện khỏe mạnh."
            if disease_id:
                return f"Đã chuyển hình ảnh vào bệnh lúa #{disease_id}."
            return "Đã chuyển hình ảnh."

        #readable message
        if obj.action == "wheat_disease_image.label_update":
            return "Đã cập nhật dữ liệu đặc tả của hình ảnh."

        #readable message
        if obj.action == "wheat_disease_image.delete":
            disease_id = changes.get("disease_id")
            return f"Đã xóa hình ảnh khỏi bệnh lúa #{disease_id}." if disease_id else "Đã xóa hình ảnh."

        fallback = (obj.action or "cập nhật dữ liệu").replace("_", " ").replace(".", " ")
        return f"Đã {fallback}."


class DiscussionThreadListSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    excerpt = serializers.CharField(source="first_message")
    replies_count = serializers.SerializerMethodField()
    last_post = serializers.SerializerMethodField()

    class Meta:
        model = DiscussionThread
        fields = (
            "id",
            "title",
            "board",
            "author",
            "excerpt",
            "created_at",
            "replies_count",
            "last_post",
        )

    
    def get_author(self, obj):
        return obj.created_by.username if obj.created_by else "deleted user"

        #tính reply
    def get_replies_count(self, obj):
        #ngưng tính lại
        annotated_count = getattr(obj, "replies_count", None)
        if annotated_count is not None:
            return annotated_count
        
        return obj.posts.count()

    #latest post
    def get_last_post(self, obj):
        latest_post = None

        prefetched_posts = getattr(obj, "_prefetched_objects_cache", {}).get("posts")
        if prefetched_posts:
            latest_post = list(prefetched_posts)[-1]

        if latest_post is None:
            latest_post = obj.posts.select_related("author").order_by("created_at").last()

        if latest_post is not None:
            return {
                "author": latest_post.author.username if latest_post.author else "deleted user",
                "created_at": latest_post.created_at,
            }

        return {
            "author": obj.created_by.username if obj.created_by else "deleted user",
            "created_at": obj.created_at,
        }


class DiscussionPostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = DiscussionPost
        fields = ("id", "author", "content", "created_at")

    def get_author(self, obj):
        return obj.author.username if obj.author else "deleted user"


class DiscussionThreadDetailSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    opening_post = serializers.SerializerMethodField()
    replies = DiscussionPostSerializer(source="posts", many=True, read_only=True)

    class Meta:
        model = DiscussionThread
        fields = (
            "id",
            "title",
            "board",
            "author",
            "created_at",
            "opening_post",
            "replies",
        )

    def get_author(self, obj):
        return obj.created_by.username if obj.created_by else "deleted user"

    def get_opening_post(self, obj):
        return {
            "id": f"thread-{obj.id}-opening",
            "author": obj.created_by.username if obj.created_by else "deleted user",
            "content": obj.first_message,
            "created_at": obj.created_at,
        }


class DiscussionThreadCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    board = serializers.CharField(max_length=80)
    content = serializers.CharField()

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        return value

    def validate_board(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Board is required.")
        return value

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Opening message is required.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        return DiscussionThread.objects.create(
            title=validated_data["title"],
            board=validated_data["board"],
            first_message=validated_data["content"],
            created_by=request.user,
        )


class DiscussionReplyCreateSerializer(serializers.Serializer):
    content = serializers.CharField()

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Reply content is required.")
        return value
