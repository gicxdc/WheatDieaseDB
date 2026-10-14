from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
# Create your models here.


#class user kế thừa từ abstract user của django
class User(AbstractUser):
    email=models.EmailField(unique=True)
    avatar_url = models.URLField(blank=True,null=True)

    #các role
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        EXPERT = "expert", "Expert"
        HELPER = "helper", "Helper"
        USER = "user", "User"
    
    role= models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
  
    def __str__(self):
        return self.username


#class bệnh cây lúa
class WheatDisease(models.Model):
    name = models.CharField(max_length=120, unique=True)
    pathogen = models.CharField(max_length=120, blank=True)
    condition = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    prevention = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wheat_diseases",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


#class OTP dùng để reset password 
class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_otps",
    )
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} - {self.otp_code}"

#class hình ảnh bệnh cây lúa
class WheatDiseaseImage(models.Model):
    disease = models.ForeignKey(
        WheatDisease,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="images",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wheat_disease_images",
    )

    image_url = models.URLField()   
    image_key = models.CharField(max_length=255, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=120, blank=True)
    background = models.CharField(max_length=120, blank=True)
    weather = models.CharField(max_length=120, blank=True)
    time_of_day = models.CharField(max_length=120, blank=True)
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    LABEL_FIELDS = ("caption", "location", "background", "weather", "time_of_day")

    #đỏi các trường label nếu để trống thành "None"
    def save(self, *args, **kwargs):
        normalized_fields = []

        #check field rỗng
        for field_name in self.LABEL_FIELDS:
            if not str(getattr(self, field_name, "") or "").strip():
                setattr(self, field_name, "None")
                normalized_fields.append(field_name)

        #save thay đổi lên db
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and normalized_fields:
            kwargs["update_fields"] = set(update_fields).union(normalized_fields)

        super().save(*args, **kwargs)

    def __str__(self):
        disease_name = self.disease.name if self.disease else "unlabeled"
        return f"{disease_name} - {self.image_url}"

#class audit log 
class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=80)
    resource_type = models.CharField(max_length=80)
    resource_id = models.CharField(max_length=80, blank=True)
    method = models.CharField(max_length=10, blank=True)
    path = models.CharField(max_length=255, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.resource_type}:{self.resource_id}"

#class discussion thread và post 
class DiscussionThread(models.Model):
    title = models.CharField(max_length=200)
    board = models.CharField(max_length=80)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="discussion_threads",
    )
    first_message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class DiscussionPost(models.Model):
    thread = models.ForeignKey(
        DiscussionThread,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="discussion_posts",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        author_name = self.author.username if self.author else "deleted user"
        return f"{self.thread_id} #{self.pk} by {author_name}"
