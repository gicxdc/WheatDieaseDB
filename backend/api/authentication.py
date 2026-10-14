from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


class CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


class CookieJWTAuthentication(JWTAuthentication):

    def authenticate(self, request):
        #lay token từ header trước, nếu không có thì check cookie
        header = self.get_header(request)
        using_cookie_token = header is None

        if not using_cookie_token:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        
        #k.o có token
        if raw_token is None:
            return None

        #nếu token lấy từ cookie thì check CSRF để chánh gửi request từ bên thứ 3
        if using_cookie_token:
            self.enforce_csrf(request)


        #Validate token rồi return user
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token


    def enforce_csrf(self, request):
        #check CSRF token
        check = CSRFCheck(lambda request: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})

        #nếu fail thì raise error
        if reason:
            raise PermissionDenied(f"CSRF Failed: {reason}")
